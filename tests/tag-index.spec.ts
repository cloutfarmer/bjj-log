import { expect, test } from "@playwright/test";
import { buildTagIndex, filterTagIndex, searchNotes, suggestTags } from "../lib/tagIndex";

import type { JournalEntryData } from "../app/types";

// Pure tests with made-up notes only.

const entry = (text: string): JournalEntryData => ({ text, sessionTypes: [], attire: null });

const entries: Record<string, JournalEntryData> = {
  "2026-11-01": entry("Armbar from guard."),
  "2026-11-05": entry("Passing and armbar again."),
  "2026-11-08": entry("   "),
  "2026-11-09": entry("Drilled takedowns."),
  "2026-11-10": entry("Heel hook entries."),
};
const entryTags = {
  "2026-11-01": { tags: [{ name: "armbar" }, { name: "guard" }] },
  "2026-11-05": { tags: [{ name: "armbar" }] },
  "2026-11-10": { tags: [{ name: "heel hook" }, { name: "mystery" }] },
  "2026-10-01": { tags: [{ name: "guard" }] },
};
const tags = { armbar: "submissions", guard: "guard", "heel hook": "leg locks", mystery: "unlisted", "knee cut": "passing" };
const order = ["guard", "passing", "submissions", "leg locks", "other"];

test("buildTagIndex counts, sorts and orders buckets", () => {
  const index = buildTagIndex(entries, entryTags, tags, order);
  expect(index.buckets.map((b) => b.bucket)).toEqual(["guard", "passing", "submissions", "leg locks", "other"]);
  const armbar = index.buckets[2].tags[0];
  expect(armbar).toEqual({ name: "armbar", bucket: "submissions", count: 2, lastDate: "2026-11-05", dates: ["2026-11-05", "2026-11-01"] });
  // The 2026-10-01 date is not in entries, so it does not count.
  expect(index.buckets[0].tags[0]).toMatchObject({ name: "guard", count: 1, lastDate: "2026-11-01" });
  expect(index.buckets[1].tags[0]).toEqual({ name: "knee cut", bucket: "passing", count: 0, lastDate: null, dates: [] });
  expect(index.buckets[4].tags[0]).toMatchObject({ name: "mystery", bucket: "unlisted", count: 1 });
});

test("buildTagIndex sorts by count then name and leaves empty buckets out", () => {
  const index = buildTagIndex(
    entries,
    { "2026-11-01": { tags: [{ name: "b" }, { name: "c" }] }, "2026-11-05": { tags: [{ name: "c" }] } },
    { a: "guard", b: "guard", c: "guard", d: "guard" },
    order,
  );
  expect(index.buckets).toHaveLength(1);
  // c has 2 dates, b has 1, a and d have none and sort by name.
  expect(index.buckets[0].tags.map((t) => t.name)).toEqual(["c", "b", "a", "d"]);
});

test("untagged lists dated, non-blank entries without tags, newest first", () => {
  const index = buildTagIndex(entries, entryTags, tags, order);
  expect(index.untagged).toEqual(["2026-11-09"]);
});

test("filterTagIndex matches tag or bucket name, case-insensitively", () => {
  const index = buildTagIndex(entries, entryTags, tags, order);
  expect(filterTagIndex(index, "")).toBe(index.buckets);
  expect(filterTagIndex(index, "ARM").map((b) => b.tags.map((t) => t.name))).toEqual([["armbar"]]);
  const byBucket = filterTagIndex(index, "leg");
  expect(byBucket).toHaveLength(1);
  expect(byBucket[0].tags.map((t) => t.name)).toEqual(["heel hook"]);
  expect(filterTagIndex(index, "zzz")).toEqual([]);
});

test("searchNotes finds text newest first and ignores tiny queries", () => {
  expect(searchNotes(entries, "ARMBAR")).toEqual(["2026-11-05", "2026-11-01"]);
  expect(searchNotes(entries, " hook ")).toEqual(["2026-11-10"]);
  expect(searchNotes(entries, "a")).toEqual([]);
  expect(searchNotes(entries, " a ")).toEqual([]);
});

test("suggestTags matches the text, skips excluded names and caps the list", () => {
  const names = ["armbar", "guard", "k guard", "mount", "back take"];
  expect(suggestTags("Armbar from k guard, then mount.", names, ["mount"])).toEqual(["k guard", "armbar"]);
  expect(suggestTags("Armbar, mount, back take.", names, [], 2)).toEqual(["back take", "armbar"]);
  expect(suggestTags("nothing", names, [])).toEqual([]);
});

test("suggestTags accepts word forms and skips passing mentions", () => {
  const names = ["arm drag", "leg drag"];
  expect(suggestTags("Drilled leg drags today.", names, [])).toEqual(["leg drag"]);
  expect(suggestTags("Drilled leg drags, finish it like an arm drag.", names, [])).toEqual(["leg drag"]);
});
