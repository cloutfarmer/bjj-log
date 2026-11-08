import type { Attire } from "../app/types";

export interface TrainingStatsData {
  thisWeek: number;
  thisMonth: number;
  total: number;
  /** Consecutive Sunday-to-Saturday weeks with at least one session. */
  weekStreak: number;
  gi: number;
  nogi: number;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/**
 * Summarises logged days relative to `today`. Dates are local `YYYY-MM-DD` keys.
 * The streak still counts when the current week has no session yet, so it does not
 * reset on a Sunday morning.
 */
export function computeTrainingStats(
  dates: Iterable<string>,
  attireByDate: ReadonlyMap<string, Attire>,
  today: Date,
): TrainingStatsData {
  const all = new Set(dates);
  const todayKey = dateKey(today);
  const monthPrefix = todayKey.slice(0, 7);
  const currentWeek = weekStart(today);

  const weeks = new Set<string>();
  let thisWeek = 0;
  let thisMonth = 0;
  for (const key of all) {
    if (key > todayKey) continue;
    const week = dateKey(weekStart(new Date(`${key}T12:00:00`)));
    weeks.add(week);
    if (week === dateKey(currentWeek)) thisWeek++;
    if (key.startsWith(monthPrefix)) thisMonth++;
  }

  let weekStreak = 0;
  const cursor = new Date(currentWeek);
  if (!weeks.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (weeks.has(dateKey(cursor))) {
    weekStreak++;
    cursor.setDate(cursor.getDate() - 7);
  }

  let gi = 0;
  let nogi = 0;
  for (const attire of attireByDate.values()) {
    if (attire === "gi") gi++;
    else nogi++;
  }

  return { thisWeek, thisMonth, total: all.size, weekStreak, gi, nogi };
}
