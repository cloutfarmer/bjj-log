import { formatCounts, type NoteCounts } from "../context";
import { limitWords } from "./json";

import type { Job } from "../types";

export interface MonthlyRecapArgs {
  month: string;
  weeklySummaries: string[];
  counts: NoteCounts;
  openItems: string[];
}
export interface MonthlyRecapOut {
  recap: string;
}

/** Takes weekly summaries, never raw notes, so a month costs about as little as a week. */
export const monthlyRecap: Job<MonthlyRecapArgs, MonthlyRecapOut> = {
  name: "monthlyRecap",
  version: 1,
  system:
    "Write a recap of this training month in at most 200 words from the weekly summaries, counts and open items. Plain text only.",
  maxOutputTokens: 350,
  buildInput: ({ weeklySummaries, counts, openItems }) =>
    [formatCounts(counts), "weeks:", ...weeklySummaries, "open:", ...openItems].join("\n"),
  parseOutput(text) {
    const recap = limitWords(text, 200);
    return recap ? { recap } : null;
  },
};
