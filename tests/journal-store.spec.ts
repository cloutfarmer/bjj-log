import { expect, test } from "@playwright/test";
import { parseDraft } from "../lib/drafts";
import { isEmptyEntry } from "../lib/entries";
import { collectionTag, isVersion, mergeEntries, parseSavedEntries, sameTag } from "../lib/entrySync";

import type { SavedEntry } from "../app/types";

// Pure function tests: no server, browser, or database. Every note here is made up.

const V1 = "20261101120000000001";
const V2 = "20261102120000000002";

function entry(text: string, version: string): SavedEntry {
  return { text, sessionTypes: ["class"], attire: "gi", version };
}

test("a version is exactly twenty digits", () => {
  expect(isVersion(V1)).toBe(true);
  expect(isVersion("2026110112000000000")).toBe(false);
  expect(isVersion("2026-11-01T12:00:00Z")).toBe(false);
  expect(isVersion(20261101120000000001)).toBe(false);
  expect(isVersion(null)).toBe(false);
});

test("the collection tag changes on an insert, an update, and a delete", () => {
  const before = collectionTag(2, V1);
  expect(collectionTag(3, V2)).not.toBe(before);
  expect(collectionTag(2, V2)).not.toBe(before);
  expect(collectionTag(1, V1)).not.toBe(before);
  expect(collectionTag(0, null)).toBe('"0-0"');
});

test("a tag marked weak by a proxy still matches", () => {
  const tag = collectionTag(2, V1);
  expect(sameTag(`W/${tag}`, tag)).toBe(true);
  expect(sameTag(collectionTag(2, V2), tag)).toBe(false);
});

test("merging keeps the object of every unchanged entry", () => {
  const previous = { "2026-11-01": entry("Old note", V1), "2026-11-02": entry("Other note", V1) };
  const next = { "2026-11-01": entry("Old note", V1), "2026-11-02": entry("Edited elsewhere", V2) };
  const merged = mergeEntries(previous, next);
  expect(merged["2026-11-01"]).toBe(previous["2026-11-01"]);
  expect(merged["2026-11-02"]).toBe(next["2026-11-02"]);
});

test("merging an identical copy returns the same collection", () => {
  const previous = { "2026-11-01": entry("Old note", V1) };
  expect(mergeEntries(previous, { "2026-11-01": entry("Old note", V1) })).toBe(previous);
});

test("merging drops a day deleted elsewhere and adds a new one", () => {
  const previous = { "2026-11-01": entry("Old note", V1), "2026-11-02": entry("Deleted elsewhere", V1) };
  const merged = mergeEntries(previous, { "2026-11-01": entry("Old note", V1), "2026-11-03": entry("New note", V2) });
  expect(Object.keys(merged).sort()).toEqual(["2026-11-01", "2026-11-03"]);
});

test("entries with an unknown version are never treated as unchanged", () => {
  const previous = { "2026-11-01": entry("Old note", "") };
  const next = { "2026-11-01": entry("Changed note", "") };
  expect(mergeEntries(previous, next)["2026-11-01"]).toBe(next["2026-11-01"]);
});

test("a server reply without versions still loads", () => {
  const parsed = parseSavedEntries({ "2026-11-01": { text: "Note", sessionTypes: ["class"], attire: "gi" } });
  expect(parsed).toEqual({ "2026-11-01": { text: "Note", sessionTypes: ["class"], attire: "gi", version: "" } });
  expect(parseSavedEntries([])).toBeNull();
  expect(parseSavedEntries({ "2026-11-01": { text: 5, sessionTypes: [] } })).toBeNull();
});

test("a stored draft is checked before use", () => {
  const draft = { entry: { text: "Draft note", sessionTypes: ["class"], attire: null }, baseVersion: V1 };
  expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
  expect(parseDraft(JSON.stringify({ ...draft, baseVersion: null }))?.baseVersion).toBeNull();
  // An unreadable base version means "unknown", never "this day had no entry".
  expect(parseDraft(JSON.stringify({ ...draft, baseVersion: "yesterday" }))?.baseVersion).toBeUndefined();
  expect(parseDraft(JSON.stringify({ entry: draft.entry }))?.baseVersion).toBeUndefined();
  expect(parseDraft(null)).toBeNull();
  expect(parseDraft("not json")).toBeNull();
  expect(parseDraft(JSON.stringify("a legacy note string"))).toBeNull();
  expect(parseDraft(JSON.stringify({ entry: "a legacy note string", baseVersion: null }))).toBeNull();
  expect(parseDraft(JSON.stringify({ entry: { text: "Bad", sessionTypes: [42] }, baseVersion: null }))).toBeNull();
});

test("attire alone keeps a day, and whitespace alone does not", () => {
  expect(isEmptyEntry({ text: "  \n", sessionTypes: [], attire: null })).toBe(true);
  expect(isEmptyEntry({ text: "", sessionTypes: [], attire: "nogi" })).toBe(false);
  expect(isEmptyEntry({ text: "", sessionTypes: ["class"], attire: null })).toBe(false);
});
