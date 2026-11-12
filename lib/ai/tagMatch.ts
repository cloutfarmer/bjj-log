const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

export const MAX_TAGS_PER_ENTRY = 5;

type Mention = { start: number; end: number; passing: boolean };

/** Fixed cue strings only, never user text, so a RegExp is safe here. */
const PASSING_CUE =
  /(?<![\p{L}\p{N}])(?:like +(?:an?|the)|(?:similar to|same as|instead of|rather than|unlike)(?: +(?:an?|the))?) *$/u;

/** True when the mention at `start` directly follows a comparison cue. */
function isPassing(haystack: string, start: number): boolean {
  let end = start;
  while (end > 0 && haystack[end - 1] === " ") end--;
  return PASSING_CUE.test(haystack.slice(Math.max(0, end - 30), end));
}

/** Length of the word-form ending that follows the name at `at`, or -1 when the word goes on. */
function endingLength(haystack: string, needle: string, at: number): number {
  const after = at + needle.length;
  const last = needle[needle.length - 1];
  const endings = ["", "s", "es", "ed", "ing", `${last}ed`, `${last}ing`];
  for (const ending of endings) {
    if (haystack.startsWith(ending, after) && !isWordChar(haystack[after + ending.length])) return ending.length;
  }
  return -1;
}

/** Every mention of needle in haystack: whole word, optionally with a word-form ending. */
function occurrences(haystack: string, needle: string): Mention[] {
  const found: Mention[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    if (!isWordChar(haystack[at - 1])) {
      const extra = endingLength(haystack, needle, at);
      if (extra >= 0) found.push({ start: at, end: at + needle.length + extra, passing: isPassing(haystack, at) });
    }
    from = at + 1;
  }
}

/** Scans for each name and keeps only real (non-passing) mentions. */
function scan(
  text: string,
  names: readonly string[],
  normalize?: (text: string) => string,
): { name: string; needle: string; at: Mention[] }[] {
  const haystack = (normalize ? normalize(text) : text).toLowerCase();
  const out: { name: string; needle: string; at: Mention[] }[] = [];
  for (const name of names) {
    const needle = name.toLowerCase();
    if (!needle) continue;
    const at = occurrences(haystack, needle).filter((m) => !m.passing);
    if (at.length) out.push({ name, needle, at });
  }
  return out;
}

/** The number of real (non-passing) mentions of each name, only for names with at least one. */
export function countMentions(
  text: string,
  names: readonly string[],
  normalize?: (text: string) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { name, at } of scan(text, names, normalize)) counts[name] = at.length;
  return counts;
}

/**
 * Finds existing tags in text without a model call, longest name first, then earliest
 * position. A name found only inside an already accepted longer match is skipped, so
 * "k guard" does not also yield "guard". A tag whose every mention is passing ("like an
 * arm drag") is not matched. The scan avoids building RegExps from user strings.
 */
export function matchTags(
  text: string,
  tagNames: readonly string[],
  normalize?: (text: string) => string,
  limit: number = MAX_TAGS_PER_ENTRY,
): string[] {
  const candidates = scan(text, tagNames, normalize);
  candidates.sort((a, b) => b.needle.length - a.needle.length || a.at[0].start - b.at[0].start);
  const accepted: { start: number; end: number }[] = [];
  const out: string[] = [];
  for (const { name, at } of candidates) {
    if (out.length >= limit) break;
    if (out.includes(name)) continue;
    const free = at.find((m) => !accepted.some((a) => m.start >= a.start && m.end <= a.end));
    if (free === undefined) continue;
    accepted.push({ start: free.start, end: free.end });
    out.push(name);
  }
  return out;
}

/**
 * True when a code match cannot be trusted alone: no known tag matched, or a glossary
 * term unrelated to the matched tags is mentioned at least as often as the main one.
 */
export function needsModel(
  text: string,
  knownNames: readonly string[],
  glossary: readonly string[],
  normalize?: (text: string) => string,
): boolean {
  const matched = matchTags(text, knownNames, normalize, Infinity);
  if (matched.length === 0) return true;
  const known = new Set(knownNames.map((n) => n.toLowerCase()));
  const matchedLower = matched.map((n) => n.toLowerCase());
  const terms = glossary.filter((term) => {
    const t = term.toLowerCase();
    if (!t || known.has(t)) return false;
    return !matchedLower.some((m) => m.includes(t) || t.includes(m));
  });
  const counts = countMentions(text, [...matched, ...terms], normalize);
  const top = Math.max(...matched.map((n) => counts[n] ?? 0));
  return terms.some((term) => (counts[term] ?? 0) >= top && (counts[term] ?? 0) > 0);
}

export function matchTag(
  text: string,
  tagNames: readonly string[],
  normalize?: (text: string) => string,
): string | null {
  return matchTags(text, tagNames, normalize)[0] ?? null;
}
