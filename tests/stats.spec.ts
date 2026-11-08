import { expect, test } from "@playwright/test";
import { computeTrainingStats } from "../lib/stats";

import type { Attire } from "../app/types";

// Pure function tests: no server, browser, or database. Every date here is made up.

/** Noon on a local calendar day, so time zones and daylight saving don't shift it. */
function day(key: string) {
  const [year, month, date] = key.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}

function stats(dates: string[], today: string, attire: Record<string, Attire> = {}) {
  return computeTrainingStats(dates, new Map(Object.entries(attire)), day(today));
}

test("a week with no session yet keeps the streak", () => {
  // Sunday 2026-11-08 starts a new week with nothing logged in it.
  const result = stats(["2026-10-27", "2026-11-03"], "2026-11-08");
  expect(result.thisWeek).toBe(0);
  expect(result.weekStreak).toBe(2);
});

test("a one-week gap ends the streak", () => {
  // Nothing in the week of 2026-11-01.
  const result = stats(["2026-10-27", "2026-11-10"], "2026-11-11");
  expect(result.weekStreak).toBe(1);
});

test("the streak continues across the new year", () => {
  const result = stats(["2026-12-22", "2026-12-29", "2027-01-05"], "2027-01-06");
  expect(result.weekStreak).toBe(3);
  expect(result.thisMonth).toBe(1);
  expect(result.total).toBe(3);
});

test("the streak continues across a daylight-saving change", () => {
  // US clocks change on 2026-11-01, between these two sessions.
  const result = stats(["2026-10-27", "2026-11-03"], "2026-11-03");
  expect(result.weekStreak).toBe(2);
  expect(result.thisWeek).toBe(1);
});

test("a planned future session counts in no figure", () => {
  const result = stats(["2026-11-10", "2026-11-12"], "2026-11-11", {
    "2026-11-10": "gi",
    "2026-11-12": "gi",
  });
  expect(result).toEqual({ thisWeek: 1, thisMonth: 1, total: 1, weekStreak: 1, gi: 1, nogi: 0 });
});
