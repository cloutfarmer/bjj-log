import { extractJson } from "./json";

import type { Job } from "../types";

export interface CleanNoteArgs {
  text: string;
}
export interface CleanNoteOut {
  edits: { from: string; to: string }[];
}

export const cleanNote: Job<CleanNoteArgs, CleanNoteOut> = {
  name: "cleanNote",
  version: 1,
  system:
    "List spelling and grammar mistakes in this Brazilian jiu-jitsu training note; never rephrase or change meaning or style, and leave technique names alone unless clearly misspelled. " +
    'Reply with JSON only: [{"from":"exact text","to":"fix"}], at most 10, [] if none.',
  maxOutputTokens: 500, // a cap, not a spend; ten edits need about 300 tokens
  buildInput: ({ text }) => text.slice(0, 4000),
  parseOutput(text, { text: note }) {
    let data = extractJson(text);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      data = (data as { edits?: unknown }).edits;
    }
    if (!Array.isArray(data)) return null;
    const seen = new Set<string>();
    const edits: { from: string; to: string }[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const { from, to } = item as { from?: unknown; to?: unknown };
      if (typeof from !== "string" || typeof to !== "string") continue;
      if (from === to) continue;
      if (from.length < 1 || from.length > 200 || to.length < 1 || to.length > 200) continue;
      if (!note.includes(from) || seen.has(from)) continue;
      seen.add(from);
      edits.push({ from, to });
      if (edits.length === 10) break;
    }
    return { edits };
  },
};
