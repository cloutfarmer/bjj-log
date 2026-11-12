/* Made-up journal data for the development-only preview at /dev. Never real notes.
 * Calendar and TrainingStats read today's date, so sessions are placed relative to
 * the start of last week. The calendar, stats, and week strip stay populated whatever
 * day the preview is opened. */
import type { JournalEntryData } from "../app/types";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const featuredText = `Knee cut from headquarters.
- Pin the far hip before sliding the knee through.
- If they frame on my knee, switch to a long step.
Rolls: 4 × 6 min. Caught once in a triangle when my posture broke.
Next time: drill the underhook on the cut side.`;

/** Days after last week's Sunday. Negative values are earlier weeks. */
const sessions: Array<{ day: number; entry: JournalEntryData }> = [
  { day: -20, entry: { text: "Closed guard retention drills.", sessionTypes: ["class"], attire: "gi" } },
  { day: -17, entry: { text: "Leg lock entries from single leg X.", sessionTypes: ["class", "drilling"], attire: "nogi" } },
  { day: -13, entry: { text: "Collar chokes from mount.", sessionTypes: ["class"], attire: "gi" } },
  { day: -11, entry: { text: "", sessionTypes: ["open-mat"], attire: null } },
  { day: -8, entry: { text: "Front headlock series: go-behind and anaconda.", sessionTypes: ["class"], attire: "nogi" } },
  { day: -6, entry: { text: "Spider guard sweeps.", sessionTypes: ["class"], attire: "gi" } },
  { day: 1, entry: { text: "Taught the fundamentals class: shrimping and elbow escapes.", sessionTypes: ["instructing"], attire: "gi" } },
  { day: 2, entry: { text: "Wrestling ups from butterfly guard.", sessionTypes: ["class"], attire: "nogi" } },
  { day: 4, entry: { text: featuredText, sessionTypes: ["class", "drilling"], attire: "gi" } },
  { day: 6, entry: { text: "Rounds only. Worked on staying calm under side control.", sessionTypes: ["open-mat"], attire: "nogi" } },
  { day: 7, entry: { text: "Berimbolo entries, slowly.", sessionTypes: ["drilling"], attire: null } },
];

const FEATURED_DAY = 4;

/** Made-up tag names and their buckets (see lib/ai/buckets.ts for the fixed list). */
const previewTags: Record<string, string> = {
  "closed guard": "guard",
  "knee cut": "passing",
  "leg entries": "leg locks",
  "mount chokes": "submissions",
};

/** Builds the fixtures for the preview, with dates relative to `today`. */
export function buildPreviewFixtures(today: Date) {
  const lastSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay() - 7);
  const keyFor = (day: number) => {
    const date = new Date(lastSunday);
    date.setDate(date.getDate() + day);
    return dateKey(date);
  };

  const todayKey = dateKey(today);
  const entries: Record<string, JournalEntryData> = Object.fromEntries(
    sessions.map(({ day, entry }) => [keyFor(day), entry] as const).filter(([key]) => key <= todayKey),
  );
  // Tags for a few dates, so the preview shows tagged, user-set and untagged notes.
  const entryTags: Record<string, { tag: string | null; source: "code" | "ai" | "user" }> = {
    [keyFor(-20)]: { tag: "closed guard", source: "ai" },
    [keyFor(-17)]: { tag: "leg entries", source: "ai" },
    [keyFor(-13)]: { tag: "mount chokes", source: "user" },
    [keyFor(FEATURED_DAY)]: { tag: "knee cut", source: "ai" },
  };
  return { entries, entryTags, tags: previewTags, featuredDate: keyFor(FEATURED_DAY) };
}
