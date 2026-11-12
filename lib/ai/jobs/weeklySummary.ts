import { compactNotes, formatCounts, type NoteCounts, type NoteForContext } from "../context";
import { limitWords } from "./json";

import type { Job } from "../types";

export interface WeeklySummaryArgs {
  weekStart: string;
  notes: NoteForContext[];
  counts: NoteCounts;
}
export interface WeeklySummaryOut {
  summary: string;
}

export const weeklySummary: Job<WeeklySummaryArgs, WeeklySummaryOut> = {
  name: "weeklySummary",
  version: 1,
  system:
    "Summarise this training week in at most 80 words using the counts given; do not count yourself. Plain text only.",
  maxOutputTokens: 150,
  buildInput: ({ notes, counts }) => `${formatCounts(counts)}\n${compactNotes(notes)}`,
  parseOutput(text) {
    const summary = limitWords(text, 80);
    return summary ? { summary } : null;
  },
};
