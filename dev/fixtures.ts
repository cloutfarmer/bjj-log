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

const longText = `Rolling notes, long version.
1. Started in half guard, lost the underhook twice.
2. Fixed it by framing early and turning to my knees.
3. Passing: pressure on the hip, then a slow switch to the far side.
4. Guard: kept my knees inside the elbows.
5. Open mat: three rounds with a bigger partner.
6. Cardio held up until the fourth round.
7. Goal for next week: fewer scrambles, more control.`;

/** Days after last week's Sunday. Negative values are earlier weeks. */
const sessions: Array<{ day: number; entry: JournalEntryData }> = [
  { day: -30, entry: { text: "Closed guard sweeps: scissor and hip bump.", sessionTypes: ["class"], attire: "gi" } },
  { day: -27, entry: { text: "Knee cut passing against a strong knee shield.", sessionTypes: ["class"], attire: "gi" } },
  { day: -24, entry: { text: longText, sessionTypes: ["open-mat"], attire: "nogi" } },
  { day: -22, entry: { text: "Armbar from mount, then the escape to back control.", sessionTypes: ["class"], attire: "gi" } },
  { day: -20, entry: { text: "Closed guard retention drills.", sessionTypes: ["class"], attire: "gi" } },
  { day: -17, entry: { text: "Leg lock entries from single leg X.", sessionTypes: ["class", "drilling"], attire: "nogi" } },
  { day: -13, entry: { text: "Collar chokes from mount.", sessionTypes: ["class"], attire: "gi" } },
  { day: -11, entry: { text: "", sessionTypes: ["open-mat"], attire: null } },
  { day: -8, entry: { text: "Front headlock series: go-behind and anaconda.", sessionTypes: ["class"], attire: "nogi" } },
  { day: -5, entry: { text: "Drilled the knee cut on both sides.", sessionTypes: ["drilling"], attire: "gi" } },
  { day: -4, entry: { text: "Closed guard posture control, then rolls.", sessionTypes: ["class"], attire: "nogi" } },
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
  "back takes": "submissions",
  "hip escape": "escapes",
  closedguard: "guard",
  "knee-cut": "passing",
};

/** Made-up merge suggestions and token counts for the cleanup and usage fakes. */
const previewMerges = [
  { from: "closedguard", into: "closed guard" },
  { from: "knee-cut", into: "knee cut" },
];
const previewUsage = {
  jobs: [
    { job: "Note tagging", runs: 42, inputTokens: 18450, outputTokens: 1260 },
    { job: "Grammar check", runs: 7, inputTokens: 3920, outputTokens: 610 },
    { job: "Tag cleanup", runs: 1, inputTokens: 380, outputTokens: 95 },
  ],
  total: { runs: 50, inputTokens: 22750, outputTokens: 1965 },
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
  // Tags for a few dates, so the preview shows several tags, one tag and untagged notes.
  const entryTags: Record<string, { tags: { name: string; source: "code" | "ai" | "user" }[]; byUser: boolean }> = {
    [keyFor(-30)]: { tags: [{ name: "closed guard", source: "ai" }], byUser: false },
    [keyFor(-27)]: { tags: [{ name: "knee cut", source: "user" }], byUser: true },
    [keyFor(-22)]: { tags: [{ name: "mount chokes", source: "ai" }], byUser: false },
    [keyFor(-20)]: { tags: [{ name: "closed guard", source: "ai" }], byUser: false },
    [keyFor(-17)]: { tags: [{ name: "leg entries", source: "ai" }], byUser: false },
    [keyFor(-13)]: { tags: [{ name: "mount chokes", source: "user" }], byUser: true },
    [keyFor(FEATURED_DAY)]: {
      tags: [
        { name: "knee cut", source: "ai" },
        { name: "closed guard", source: "code" },
        { name: "mount chokes", source: "user" },
      ],
      byUser: true,
    },
  };
  return { entries, entryTags, tags: previewTags, featuredDate: keyFor(FEATURED_DAY), cleanupMerges: previewMerges, usage: previewUsage };
}
