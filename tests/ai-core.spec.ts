import { expect, test } from "@playwright/test";
import { compactNote, compactNotes, countNotes, formatCounts, openNextItems } from "../lib/ai/context";
import type { NoteForContext } from "../lib/ai/context";
import { JOBS } from "../lib/ai/jobs";
import { extractJson } from "../lib/ai/jobs/json";
import { runJob } from "../lib/ai/run";
import { countMentions, matchTag, matchTags, needsModel } from "../lib/ai/tagMatch";
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
  const { provider, calls } = fakeProvider(reply('{"tags":[{"tag":"k guard","bucket":"guard"}]}'));
  const { store, saved, runs } = memoryStore();
  const deps = { store, provider, model: "m" };
  const args = { text: "Worked k guard.", tags: [] as string[] };

  const first = await runJob(JOBS.tagNote, "2026-11-10", args, deps);
  expect(first).toEqual({
    ok: true,
    output: { tags: [{ tag: "k guard", bucket: "guard" }] },
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

test("invalid model text is logged, retried once, then never sent again", async () => {
  const { provider, calls } = fakeProvider(reply("not json at all"));
  const { store, runs } = memoryStore();
  const deps = { store, provider, model: "m" };
  for (let attempt = 0; attempt < 4; attempt++) {
    expect(await runJob(JOBS.cleanNote, "d", { text: "abc" }, deps)).toEqual({ ok: false, error: "invalid-output" });
  }
  // Two paid calls in total, however often the same note is asked about.
  expect(calls).toHaveLength(2);
  expect(runs).toHaveLength(2);

  // A changed note is a new input and is sent.
  await runJob(JOBS.cleanNote, "d", { text: "abcd" }, deps);
  expect(calls).toHaveLength(3);
});

test("a good reply after an invalid one is saved and served from the cache", async () => {
  const { store } = memoryStore();
  const bad = fakeProvider(reply("not json at all"));
  const good = fakeProvider(reply("[]"));
  expect((await runJob(JOBS.cleanNote, "d", { text: "abc" }, { store, provider: bad.provider, model: "m" })).ok).toBe(false);
  const second = await runJob(JOBS.cleanNote, "d", { text: "abc" }, { store, provider: good.provider, model: "m" });
  expect(second).toMatchObject({ ok: true, cached: false, output: { edits: [] } });
  const third = await runJob(JOBS.cleanNote, "d", { text: "abc" }, { store, provider: good.provider, model: "m" });
  expect(third).toMatchObject({ ok: true, cached: true });
  expect(good.calls).toHaveLength(1);
});

test("a failed usage log does not throw away a paid reply", async () => {
  const { provider, calls } = fakeProvider(reply("[]"));
  const { store, saved } = memoryStore();
  const failingLog = { ...store, logRun: async () => { throw new Error("log failed"); } };
  const deps = { store: failingLog, provider, model: "m" };
  expect(await runJob(JOBS.cleanNote, "d", { text: "abc" }, deps)).toMatchObject({ ok: true, cached: false });
  expect(saved.size).toBe(1);
  expect(await runJob(JOBS.cleanNote, "d", { text: "abc" }, deps)).toMatchObject({ ok: true, cached: true });
  expect(calls).toHaveLength(1);
});

test("tagNote reuses existing tags case-insensitively", () => {
  const out = JOBS.tagNote.parseOutput('{"tags":[{"tag":"  K  Guard "},{"tag":"k guard"}]}', { text: "x", tags: ["k guard"] });
  expect(out).toEqual({ tags: [{ tag: "k guard", bucket: null }] });
});

test("tagNote accepts new tags with a valid or bad bucket", () => {
  const args = { text: "x", tags: ["armbar"] };
  const raw = '{"tags":[{"tag":"heel hook","bucket":"leg locks"},{"tag":"toe hold","bucket":"nonsense"},{"tag":"armbar"}]}';
  expect(JOBS.tagNote.parseOutput(raw, args)).toEqual({
    tags: [
      { tag: "heel hook", bucket: "leg locks" },
      { tag: "toe hold", bucket: "other" },
      { tag: "armbar", bucket: null },
    ],
  });
});

test("tagNote parses fenced JSON, allows an empty list, rejects junk", () => {
  const args = { text: "x", tags: [] as string[] };
  const fenced = '```json\n{"tags":[{"tag":"mount","bucket":"pins"}]}\n```';
  expect(JOBS.tagNote.parseOutput(fenced, args)).toEqual({ tags: [{ tag: "mount", bucket: "pins" }] });
  expect(JOBS.tagNote.parseOutput('{"tags":[]}', args)).toEqual({ tags: [] });
  expect(JOBS.tagNote.parseOutput("sorry, no", args)).toBeNull();
  expect(JOBS.tagNote.parseOutput('{"tag":"mount"}', args)).toBeNull();
  expect(JOBS.tagNote.parseOutput('{"tags":"mount"}', args)).toBeNull();
  expect(JOBS.tagNote.parseOutput('{"tags":[{"tag":""},{"tag":5},7]}', args)).toEqual({ tags: [] });
  expect(extractJson("nothing")).toBeUndefined();
});

test("extractJson reads the first complete JSON value", () => {
  expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  expect(extractJson("[1,2]")).toEqual([1, 2]);
  expect(extractJson('```json\n{"a":[1]}\n```')).toEqual({ a: [1] });
  expect(extractJson('Here you go: [{"from":"a","into":"b"}] Note: [] means none.')).toEqual([
    { from: "a", into: "b" },
  ]);
  expect(extractJson('{"tags":[{"tag":"knee cut"}]}\n\nI chose this because the note says "knee cut" (a pass).')).toEqual({
    tags: [{ tag: "knee cut" }],
  });
  expect(extractJson('Result: [{"from":"a ] \\" b","to":"c"}] done [x].')).toEqual([{ from: 'a ] " b', to: "c" }]);
  expect(extractJson('{"tags":[{"tag":"knee cut"},{"tag":"half gu')).toBeUndefined();
  expect(extractJson("no json here")).toBeUndefined();
  // Accepted cost: an unclosed bracket in prose before the JSON means no result.
  expect(extractJson('see [1 then {"a":1}')).toBeUndefined();
});

test("tagNote keeps at most 3 tags", () => {
  const items = ["a1", "b2", "c3", "d4", "e5"].map((tag) => ({ tag }));
  const out = JOBS.tagNote.parseOutput(JSON.stringify({ tags: items }), { text: "x", tags: [] });
  expect(out?.tags.map((t) => t.tag)).toEqual(["a1", "b2", "c3"]);
});

test("tagNote returns null for a reply cut off mid-JSON", () => {
  const cut = '{"tags":[{"tag":"knee cut","bucket":"passing"},{"tag":"half gu';
  expect(JOBS.tagNote.parseOutput(cut, { text: "x", tags: [] })).toBeNull();
});

test("tagNote leaves room for a full reply", () => {
  // A cap of 80 truncated real replies.
  expect(JOBS.tagNote.maxOutputTokens).toBeGreaterThanOrEqual(150);
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

test("cleanNote and tagCleanup leave room for a full reply", () => {
  // Smaller caps cut real replies short, which then fail to parse.
  expect(JOBS.cleanNote.maxOutputTokens).toBeGreaterThanOrEqual(400);
  expect(JOBS.tagCleanup.maxOutputTokens).toBeGreaterThanOrEqual(500);
});

test("cleanNote returns null for a reply cut off mid-JSON", () => {
  const cut = '[{"from":"teh","to":"the"},{"from":"rec';
  expect(JOBS.cleanNote.parseOutput(cut, { text: "teh guard and recieve" })).toBeNull();
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
  expect(matchTag("Armbars today", ["armbar"])).toBe("armbar");
  expect(matchTag("Hit an armbar.", ["armbar"])).toBe("armbar");
  expect(matchTag("Worked K Guard, then more.", ["k guard"])).toBe("k guard");
  expect(matchTag("k guard to guard", ["guard", "k guard"])).toBe("k guard");
  expect(matchTag("nothing here", ["guard", ""])).toBeNull();
  expect(matchTag("K-GUARD", ["k guard"], (t) => t.replace(/-/g, " "))).toBe("k guard");
});

test("matchTags returns every tag, longest first, and skips names nested in a longer match", () => {
  expect(matchTags("Armbar from mount, then back take.", ["mount", "armbar", "back take"])).toEqual([
    "back take",
    "armbar",
    "mount",
  ]);
  expect(matchTags("k guard to guard", ["guard", "k guard"])).toEqual(["k guard", "guard"]);
  expect(matchTags("Worked k guard.", ["guard", "k guard"])).toEqual(["k guard"]);
  expect(matchTags("nothing here", ["guard", ""])).toEqual([]);
  expect(matchTags("a1 b2 c3", ["a1", "b2", "c3"], undefined, 2)).toEqual(["a1", "b2"]);
  expect(matchTags("K-GUARD and mount", ["k guard", "mount"], (t) => t.replace(/-/g, " "))).toEqual(["k guard", "mount"]);
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
  tags: ["k guard", "knee cut"],
};

test("compactNote formats one line", () => {
  expect(compactNote(note)).toBe(
    "2026-11-10 | nogi | open-mat | k guard+knee cut | Entered from seated. | next: try the backside entry (open)",
  );
  const bare = compactNote({ date: "2026-11-11", entry: { text: "a | b\n\nc", sessionTypes: [], attire: null }, tags: [] });
  expect(bare).toBe("2026-11-11 | neither | - | - | a / b c");
});

const set: NoteForContext[] = [
  note,
  { date: "2026-11-08", entry: { text: "Leg entanglement.\nnext: heel hook finish (done)", sessionTypes: ["gi"], attire: "gi" }, tags: ["heel hooks"] },
  { date: "2026-11-09", entry: { text: "Passing.", sessionTypes: [], attire: null }, tags: ["knee cut"] },
];

test("counts, formatting and open items", () => {
  const counts = countNotes(set, { "k guard": "guard", "heel hooks": "leg locks" });
  expect(counts).toEqual({
    notes: 3,
    tags: { "k guard": 1, "knee cut": 2, "heel hooks": 1 },
    buckets: { guard: 1, other: 2, "leg locks": 1 },
    nextOpen: 1,
    nextDone: 1,
  });
  expect(formatCounts(counts)).toBe(
    "notes 3; tags knee cut 2, heel hooks 1, k guard 1; buckets other 2, guard 1, leg locks 1; next open 1 done 1",
  );
  expect(openNextItems(set)).toEqual(["2026-11-10: try the backside entry"]);
  expect(compactNotes(set).split("\n")[0].startsWith("2026-11-08")).toBe(true);
});

test("matchTags accepts word forms but not other longer words", () => {
  for (const text of ["Hit leg drags.", "Hit leg dragged him", "leg dragging works"]) {
    expect(matchTags(text, ["leg drag"])).toEqual(["leg drag"]);
  }
  expect(matchTag("Climbed the mountain", ["mount"])).toBeNull();
  expect(matchTag("An armbarish thing", ["armbar"])).toBeNull();
});

test("matchTags ignores passing mentions", () => {
  const text = "Drilled leg drags, could also finish it like an arm drag.";
  expect(matchTags(text, ["arm drag", "leg drag"])).toEqual(["leg drag"]);
  expect(matchTags(text, ["arm drag"])).toEqual([]);
  expect(matchTags("Hit an arm drag, then another like an arm drag.", ["arm drag"])).toEqual(["arm drag"]);
  expect(matchTags("I dislike a triangle", ["triangle"])).toEqual(["triangle"]);
  expect(matchTags("Used a kimura instead of the triangle", ["triangle"])).toEqual([]);
});

test("countMentions counts real mentions only", () => {
  const text = "Leg drags and a leg drag, plus mount, like a mount, like an arm drag.";
  expect(countMentions(text, ["leg drag", "mount", "arm drag", "guard"])).toEqual({ "leg drag": 2, mount: 1 });
});

test("needsModel asks the model when known tags miss the main technique", () => {
  const text = "Drilled leg drags, could also finish it like an arm drag.";
  const glossary = ["leg drag", "arm drag", "side control"];
  expect(needsModel(text, ["arm drag", "side control"], glossary)).toBe(true);
  expect(needsModel("nothing relevant", ["arm drag"], glossary)).toBe(true);
  expect(needsModel(text, ["leg drag"], glossary)).toBe(false);
  expect(
    needsModel("Leg drag, leg drag, then side control.", ["leg drag"], ["leg drag", "side control"]),
  ).toBe(false);
  expect(
    needsModel("Leg drag, leg drag, then side control, then side control, side control.", ["leg drag"], ["leg drag", "side control"]),
  ).toBe(true);
});
