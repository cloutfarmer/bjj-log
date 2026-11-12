import { extractJson } from "./json";

import type { Job } from "../types";

export interface TagCleanupArgs {
  tags: { name: string; count: number }[];
}
export interface TagCleanupOut {
  merges: { from: string; into: string }[];
}

export const tagCleanup: Job<TagCleanupArgs, TagCleanupOut> = {
  name: "tagCleanup",
  version: 1,
  system:
    "These are tags from a jiu-jitsu journal with usage counts; suggest merges only for duplicates, misspellings or variants of the same thing, merging into the more used or better spelled name. " +
    'Reply with JSON only: [{"from":"...","into":"..."}], [] if none.',
  maxOutputTokens: 300,
  buildInput: ({ tags }) =>
    [...tags]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((t) => `${t.name} (${t.count})`)
      .join("\n"),
  parseOutput(text, { tags }) {
    let data = extractJson(text);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      data = (data as { merges?: unknown }).merges;
    }
    if (!Array.isArray(data)) return null;
    const names = new Set(tags.map((t) => t.name));
    const seen = new Set<string>();
    const merges: { from: string; into: string }[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const raw = item as { from?: unknown; into?: unknown };
      if (typeof raw.from !== "string" || typeof raw.into !== "string") continue;
      const from = raw.from.trim();
      const into = raw.into.trim();
      if (from === into || !names.has(from) || !names.has(into) || seen.has(from)) continue;
      seen.add(from);
      merges.push({ from, into });
    }
    // A target that is itself merged away would chain; drop it.
    return { merges: merges.filter((m) => !seen.has(m.into)) };
  },
};
