import { compactNotes, type NoteForContext } from "../context";

import type { Job } from "../types";

export interface DailyBriefArgs {
  date: string;
  openItems: string[];
  /** The last three notes. */
  recent: NoteForContext[];
}
export interface DailyBriefOut {
  focus: string;
}

export const dailyBrief: Job<DailyBriefArgs, DailyBriefOut> = {
  name: "dailyBrief",
  version: 1,
  system:
    "From these open items and recent notes, write a focus for the next session in at most two sentences. Plain text only.",
  maxOutputTokens: 80,
  buildInput: ({ openItems, recent }) =>
    [
      openItems.length ? openItems.map((i) => `open: ${i}`).join("\n") : "open: none",
      "recent:",
      compactNotes(recent),
    ].join("\n"),
  parseOutput(text) {
    const focus = text.trim().slice(0, 400);
    return focus ? { focus } : null;
  },
};
