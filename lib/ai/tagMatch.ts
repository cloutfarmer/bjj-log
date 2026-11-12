const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

export const MAX_TAGS_PER_ENTRY = 5;

/** Every whole-word start position of needle in haystack. */
function occurrences(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    if (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[at + needle.length])) found.push(at);
    from = at + 1;
  }
}

/**
 * Finds existing tags in text without a model call, longest name first, then earliest
 * position. A name found only inside an already accepted longer match is skipped, so
 * "k guard" does not also yield "guard". The scan avoids building RegExps from user strings.
 */
export function matchTags(
  text: string,
  tagNames: readonly string[],
  normalize?: (text: string) => string,
  limit: number = MAX_TAGS_PER_ENTRY,
): string[] {
  const haystack = (normalize ? normalize(text) : text).toLowerCase();
  const candidates: { name: string; needle: string; at: number[] }[] = [];
  for (const name of tagNames) {
    const needle = name.toLowerCase();
    if (!needle) continue;
    const at = occurrences(haystack, needle);
    if (at.length) candidates.push({ name, needle, at });
  }
  candidates.sort((a, b) => b.needle.length - a.needle.length || a.at[0] - b.at[0]);
  const accepted: { start: number; end: number }[] = [];
  const out: string[] = [];
  for (const { name, needle, at } of candidates) {
    if (out.length >= limit) break;
    if (out.includes(name)) continue;
    const free = at.find((start) => !accepted.some((a) => start >= a.start && start + needle.length <= a.end));
    if (free === undefined) continue;
    accepted.push({ start: free, end: free + needle.length });
    out.push(name);
  }
  return out;
}

export function matchTag(
  text: string,
  tagNames: readonly string[],
  normalize?: (text: string) => string,
): string | null {
  return matchTags(text, tagNames, normalize)[0] ?? null;
}
