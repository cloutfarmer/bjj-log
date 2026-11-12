import { expect, test } from "@playwright/test";
import { compactNote, compactNotes, countNotes, formatCounts, openNextItems } from "../lib/ai/context";
import type { NoteForContext } from "../lib/ai/context";
import { JOBS } from "../lib/ai/jobs";
import { extractJson } from "../lib/ai/jobs/json";
import { runJob } from "../lib/ai/run";
import { matchTag } from "../lib/ai/tagMatch";
import type { JobName, Provider, ProviderResponse, RunRecord, SavedOutput, Store } from "../lib/ai/types";
import { parseNextItems, stripNextItems } from "../lib/nextItems";

// Pure tests: fake provider and in-memory store, made-up notes only.

function fakeProvider(reply: ProviderResponse | Error) {
  const calls: string[] = [];
  const provider: Provider = {
    async complete(request) {
      calls.push(request.input);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { provider, calls };
}

function memoryStore() {
  const saved = new Map<string, SavedOutput>();
  const runs: RunRecord[] = [];
  const store: Store = {
    async getOutput(job: JobName, scope: string) {
      return saved.get(`${job}:${scope}`) ?? null;
    },
    async saveOutput(job, scope, inputHash, output) {
      saved.set(`${job}:${scope}`, { inputHash, output });
    },
    async logRun(run) {
      runs.push(run);
    },
  };
  return { store, saved, runs };
}

const reply = (text: string): ProviderResponse => ({ text, inputTokens: 40, outputTokens: 7 });

test("runJob calls once, saves, logs, then serves the cache", async () => {
  const { provider, calls } = fakeProvider(reply('{"tag":"k guard","bucket":"guard"}'));
  const { store, saved, runs } = memoryStore();
  const deps = { store, provider, model: "m" };
  const args = { text: "Worked k guard.", tags: [] as string[] };

  const first = await runJob(JOBS.tagNote, "2026-11-10", args, deps);
  expect(first).toEqual({
    ok: true,
    output: { tag: "k guard", bucket: "guard" },
    cached: false,
    inputTokens: 40,
    outputTokens: 7,
  });
  expect(calls).toHaveLength(1);
  expect(saved.size).toBe(1);
  expect(runs).toEqual([{ job: "tagNote", model: "m", inputTokens: 40, outputTokens: 7 }]);

  const second = await runJob(JOBS.tagNote, "2026-11-10", args, deps);
  expect(second.ok && second.cached).toBe(true);
  expect(calls).toHaveLength(1);
  expect(runs).toHaveLength(1);

  await runJob(JOBS.tagNote, "2026-11-10", { ...args, text: "Different note." }, deps);
  expect(calls).toHaveLength(2);
});

test("a provider failure saves and logs nothing", async () => {
  const { provider } = fakeProvider(new Error("boom"));
  const { store, saved, runs } = memoryStore();
  const result = await runJob(JOBS.cleanNote, "d", { text: "abc" }, { store, provider, model: "m" });
  expect(result).toEqual({ ok: false, error: "provider" });
  expect(saved.size).toBe(0);
  expect(runs).toHaveLength(0);
});

test("invalid model text is logged but not saved", async () => {
  const { provider } = fakeProvider(reply("not json at all"));
  const { store, saved, runs } = memoryStore();
  const result = await runJob(JOBS.cleanNote, "d", { text: "abc" }, { store, provider, model: "m" });
  expect(result).toEqual({ ok: false, error: "invalid-output" });
  expect(saved.size).toBe(0);
  expect(runs).toHaveLength(1);
});

test("tagNote reuses an existing tag case-insensitively", () => {
  const out = JOBS.tagNote.parseOutput('{"tag":"  K  Guard "}', { text: "x", tags: ["k guard"] });
  expect(out).toEqual({ tag: "k guard", bucket: null });
});

test("tagNote accepts a new tag with a valid or bad bucket", () => {
  const args = { text: "x", tags: ["armbar"] };
  expect(JOBS.tagNote.parseOutput('{"tag":"heel hook","bucket":"leg locks"}', args)).toEqual({
    tag: "heel hook",
    bucket: "leg locks",
  });
  expect(JOBS.tagNote.parseOutput('{"tag":"heel hook","bucket":"nonsense"}', args)).toEqual({
    tag: "heel hook",
    bucket: "other",
  });
});

test("tagNote parses fenced JSON and rejects junk", () => {
  const args = { text: "x", tags: [] as string[] };
  const fenced = '```json\n{"tag":"mount","bucket":"pins"}\n```';
  expect(JOBS.tagNote.parseOutput(fenced, args)).toEqual({ tag: "mount", bucket: "pins" });
  expect(JOBS.tagNote.parseOutput("sorry, no", args)).toBeNull();
  expect(JOBS.tagNote.parseOutput('{"tag":""}', args)).toBeNull();
  expect(JOBS.tagNote.parseOutput('{"tag":5}', args)).toBeNull();
  expect(extractJson("nothing")).toBeUndefined();
});

test("cleanNote drops unknown edits and caps at 10", () => {
  const text = "teh guard and recieve";
  const edits = [{ from: "teh", to: "the" }, { from: "missing", to: "found" }, { from: "same", to: "same" }];
  const out = JOBS.cleanNote.parseOutput(JSON.stringify(edits), { text });
  expect(out).toEqual({ edits: [{ from: "teh", to: "the" }] });

  const many = Array.from({ length: 15 }, (_, i) => ({ from: `w${i}`, to: `x${i}` }));
  const long = many.map((e) => e.from).join(" ");
  expect(JOBS.cleanNote.parseOutput(JSON.stringify(many), { text: long })?.edits).toHaveLength(10);
  expect(JOBS.cleanNote.parseOutput("[]", { text })).toEqual({ edits: [] });
  expect(JOBS.cleanNote.parseOutput('{"a":1}', { text })).toBeNull();
});

test("tagCleanup drops unknown names and self-merges", () => {
  const tags = [
    { name: "armbar", count: 5 },
    { name: "arm bar", count: 1 },
    { name: "kimura", count: 2 },
  ];
  const merges = [
    { from: "arm bar", into: "armbar" },
    { from: "armbar", into: "armbar" },
    { from: "ghost", into: "armbar" },
    { from: "kimura", into: "nothing" },
  ];
  expect(JOBS.tagCleanup.parseOutput(JSON.stringify(merges), { tags })).toEqual({
    merges: [{ from: "arm bar", into: "armbar" }],
  });
  expect(JOBS.tagCleanup.parseOutput("nope", { tags })).toBeNull();
});

test("matchTag respects word boundaries, length and normalize", () => {
  expect(matchTag("Armbars today", ["armbar"])).toBeNull();
  expect(matchTag("Hit an armbar.", ["armbar"])).toBe("armbar");
  expect(matchTag("Worked K Guard, then more.", ["k guard"])).toBe("k guard");
  expect(matchTag("k guard to guard", ["guard", "k guard"])).toBe("k guard");
  expect(matchTag("nothing here", ["guard", ""])).toBeNull();
  expect(matchTag("K-GUARD", ["k guard"], (t) => t.replace(/-/g, " "))).toBe("k guard");
});

test("parseNextItems and stripNextItems", () => {
  const text = "Drilled.\nNext: try the backside entry\n  next: [x] finish the choke\nNEXT: pass faster (Done)\nnext:\nnext: [ ] rest";
  expect(parseNextItems(text)).toEqual([
    { text: "try the backside entry", done: false },
    { text: "finish the choke", done: true },
    { text: "pass faster", done: true },
    { text: "rest", done: false },
  ]);
  expect(stripNextItems(text)).toBe("Drilled.");
});

const note: NoteForContext = {
  date: "2026-11-10",
  entry: { text: "Entered from seated.\nnext: try the backside entry", sessionTypes: ["open-mat"], attire: "nogi" },
  tag: "k guard",
};

test("compactNote formats one line", () => {
  expect(compactNote(note)).toBe(
    "2026-11-10 | nogi | open-mat | k guard | Entered from seated. | next: try the backside entry (open)",
  );
  const bare = compactNote({ date: "2026-11-11", entry: { text: "a | b\n\nc", sessionTypes: [], attire: null }, tag: null });
  expect(bare).toBe("2026-11-11 | neither | - | - | a / b c");
});

const set: NoteForContext[] = [
  note,
  { date: "2026-11-08", entry: { text: "Leg entanglement.\nnext: heel hook finish (done)", sessionTypes: ["gi"], attire: "gi" }, tag: "heel hooks" },
  { date: "2026-11-09", entry: { text: "Passing.", sessionTypes: [], attire: null }, tag: "knee cut" },
];

test("counts, formatting and open items", () => {
  const counts = countNotes(set, { "k guard": "guard", "heel hooks": "leg locks" });
  expect(counts).toEqual({
    notes: 3,
    tags: { "k guard": 1, "heel hooks": 1, "knee cut": 1 },
    buckets: { guard: 1, "leg locks": 1, other: 1 },
    nextOpen: 1,
    nextDone: 1,
  });
  expect(formatCounts(counts)).toBe(
    "notes 3; tags heel hooks 1, k guard 1, knee cut 1; buckets guard 1, leg locks 1, other 1; next open 1 done 1",
  );
  expect(openNextItems(set)).toEqual(["2026-11-10: try the backside entry"]);
  expect(compactNotes(set).split("\n")[0].startsWith("2026-11-08")).toBe(true);
});
