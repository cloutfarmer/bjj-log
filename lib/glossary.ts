/**
 * Zero-token spelling help for technique names. Pure code with no network or AI call,
 * so it runs in the browser on the draft and on the server. It only suggests fixes:
 * a rare false positive costs the user one tap, so the rules stay conservative.
 */

/** Canonical lowercase spellings. */
export const GLOSSARY: readonly string[] = [
  // Guards
  "de la riva",
  "reverse de la riva",
  "x guard",
  "single leg x",
  "k guard",
  "half guard",
  "deep half",
  "butterfly guard",
  "closed guard",
  "open guard",
  "spider guard",
  "lasso guard",
  "worm guard",
  "lapel guard",
  "rubber guard",
  "z guard",
  "knee shield",
  "50/50",
  "saddle",
  "ashi garami",
  "outside ashi",
  "octopus guard",
  "shin to shin",
  "matrix",
  "false reap",
  "berimbolo",
  "kiss of the dragon",
  "crab ride",
  "guard retention",
  "guard pull",
  // Passing
  "leg drag",
  "knee cut",
  "torreando",
  "over under",
  "stack pass",
  "smash pass",
  "body lock pass",
  "long step",
  "x pass",
  // Submissions
  "kimura",
  "americana",
  "omoplata",
  "gogoplata",
  "triangle",
  "arm triangle",
  "darce",
  "anaconda",
  "guillotine",
  "ezekiel",
  "bow and arrow",
  "cross collar choke",
  "loop choke",
  "baseball bat choke",
  "north south choke",
  "rear naked choke",
  "armbar",
  "ankle lock",
  "straight ankle lock",
  "heel hook",
  "inside heel hook",
  "outside heel hook",
  "kneebar",
  "toe hold",
  "calf slicer",
  "estima lock",
  "aoki lock",
  "wrist lock",
  "buggy choke",
  "von flue choke",
  "mounted triangle",
  "choi bar",
  "tarikoplata",
  "baratoplata",
  "mir lock",
  "peruvian necktie",
  "japanese necktie",
  "kata gatame",
  "sankaku",
  "juji gatame",
  "ude garami",
  "twister",
  // Positions
  "s mount",
  "mount",
  "side control",
  "kesa gatame",
  "north south",
  "knee on belly",
  "back control",
  "body triangle",
  "turtle",
  "front headlock",
  "crucifix",
  "truck",
  // Takedowns and wrestling
  "single leg",
  "double leg",
  "ankle pick",
  "arm drag",
  "snap down",
  "uchi mata",
  "osoto gari",
  "ouchi gari",
  "kouchi gari",
  "seoi nage",
  "tomoe nage",
  "sumi gaeshi",
  "tai otoshi",
  "harai goshi",
  "wrestle up",
  "dogfight",
  // Sweeps
  "scissor sweep",
  "hip bump sweep",
  "flower sweep",
  "pendulum sweep",
  "tripod sweep",
  "sickle sweep",
  "balloon sweep",
  "waiter sweep",
  "old school sweep",
  "john wayne sweep",
  // Movement and grips
  "shrimp",
  "granby roll",
  "imanari roll",
  "technical stand up",
  "underhook",
  "overhook",
  "whizzer",
  "collar tie",
  "two on one",
  "russian tie",
  "cross face",
  "frames",
  "inversion",
  "leg pummeling",
];

/** Known wrong spellings (lowercase) and what they should be. */
const MISSPELLINGS: Record<string, string> = {
  "de la hiva": "de la riva",
  "dela riva": "de la riva",
  delariva: "de la riva",
  "de la heva": "de la riva",
  "de la reva": "de la riva",
  "de lariva": "de la riva",
  "reverse dela riva": "reverse de la riva",
  kimora: "kimura",
  kamura: "kimura",
  kimoura: "kimura",
  omaplata: "omoplata",
  "oma plata": "omoplata",
  omoplatta: "omoplata",
  gullotine: "guillotine",
  guilotine: "guillotine",
  guillotene: "guillotine",
  guillatine: "guillotine",
  "d'arce": "darce",
  "d arce": "darce",
  ezekial: "ezekiel",
  berimbollo: "berimbolo",
  berimbolu: "berimbolo",
  toreando: "torreando",
  toriando: "torreando",
  americano: "americana",
  "ashi garame": "ashi garami",
  "ashi gurami": "ashi garami",
  uchimata: "uchi mata",
  "kesa gatami": "kesa gatame",
  wizzer: "whizzer",
  "half gaurd": "half guard",
  "closed gaurd": "closed guard",
  "open gaurd": "open guard",
  gaurd: "guard",
  "heal hook": "heel hook",
  "arm bar": "armbar",
  "knee bar": "kneebar",
  toehold: "toe hold",
  "technical standup": "technical stand up",
  "technical stand-up": "technical stand up",
  northsouth: "north south",
  "side controll": "side control",
  "butterfly gaurd": "butterfly guard",
  "spyder guard": "spider guard",
  "triangel": "triangle",
  "tripod sweap": "tripod sweep",
  "scisor sweep": "scissor sweep",
  "scissors sweep": "scissor sweep",
  "knee on stomach": "knee on belly",
  "rear nake choke": "rear naked choke",
};

/** Ordinary words that sit one edit from a single-word term and must never be flagged. */
const COMMON_WORDS: ReadonlySet<string> = new Set([
  "american",
  "twisted",
  "twisting",
  "twitter",
  "overlook",
  "overlooked",
  "whizzed",
  "triangled",
  "inverted",
  "inversions",
  "underhooks",
  "overhooks",
  "dogfights",
  "dogfighting",
]);

export interface Correction {
  /** The exact substring of the text that looks misspelled. */
  from: string;
  /** The suggested replacement, with the original's leading capital kept. */
  to: string;
  /** Start offset of `from` in the text. */
  index: number;
}

interface Candidate extends Correction {
  end: number;
  explicit: boolean;
  distance: number;
}

interface Word {
  start: number;
  end: number;
  lower: string;
}

const MAX_WINDOW = 4;
const MIN_FUZZY_LENGTH = 7;
const WORD_PATTERN = /[\p{L}\p{N}'/]+/gu;
const SPACES_ONLY = /^[ \t]+$/;
const SUFFIXES = ["s", "es", "ed", "d", "ing", "er", "ers"];

const GLOSSARY_SET: ReadonlySet<string> = new Set(GLOSSARY);
const GLOSSARY_WORDS: ReadonlySet<string> = new Set(GLOSSARY.flatMap((term) => term.split(" ")));

interface FuzzyTerm {
  term: string;
  limit: number;
}

// Fuzzy terms are bucketed by word count and first character once at load, so each
// text window only compares against a handful of terms.
const FUZZY_TERMS = new Map<string, FuzzyTerm[]>();
for (const term of GLOSSARY) {
  if (term.length < MIN_FUZZY_LENGTH) continue;
  const key = `${term.split(" ").length}|${term[0]}`;
  const bucket = FUZZY_TERMS.get(key) ?? [];
  bucket.push({ term, limit: term.length < 10 ? 1 : 2 });
  FUZZY_TERMS.set(key, bucket);
}

/** Edit distance, or `limit + 1` as soon as it is certain to exceed `limit`. */
function distanceWithin(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    previous = row;
  }
  return previous[b.length];
}

function tokenize(text: string): Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    let start = match.index;
    let end = start + match[0].length;
    // Quotes around a word are punctuation, not part of the word.
    while (start < end && text[start] === "'") start += 1;
    while (end > start && text[end - 1] === "'") end -= 1;
    if (start < end) words.push({ start, end, lower: text.slice(start, end).toLowerCase() });
  }
  return words;
}

/** True for plural and verb forms of a term, which are correct English, not typos. */
function isInflection(w: string, term: string) {
  const stem = term.endsWith("e") ? term.slice(0, -1) : term;
  return SUFFIXES.some((suffix) => w === term + suffix || w === stem + suffix);
}

function matchCase(from: string, to: string) {
  const first = from[0];
  return first !== first.toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to;
}

function overlaps(a: Candidate, b: Candidate) {
  return a.index < b.end && b.index < a.end;
}

/**
 * Suggests fixes for misspelled technique names. Windows of up to four words never
 * cross punctuation or a line break, so unrelated words are not glued together.
 */
export function findCorrections(text: string): Correction[] {
  const words = tokenize(text);
  const candidates: Candidate[] = [];
  // Spans that are already a correct term, so a near miss inside one is ignored.
  const exact: Array<[number, number]> = [];

  for (let i = 0; i < words.length; i += 1) {
    const parts: string[] = [];
    for (let n = 1; n <= MAX_WINDOW && i + n <= words.length; n += 1) {
      const last = words[i + n - 1];
      if (n > 1 && !SPACES_ONLY.test(text.slice(words[i + n - 2].end, last.start))) break;
      parts.push(last.lower);
      const w = parts.join(" ");
      const start = words[i].start;
      const from = text.slice(start, last.end);

      const fixed = Object.hasOwn(MISSPELLINGS, w) ? MISSPELLINGS[w] : undefined;
      if (fixed) {
        candidates.push({
          from,
          to: matchCase(from, fixed),
          index: start,
          end: last.end,
          explicit: true,
          distance: distanceWithin(w, fixed, w.length + fixed.length),
        });
        continue;
      }

      if (GLOSSARY_SET.has(w)) {
        exact.push([start, last.end]);
        continue;
      }
      if (parts.some((part) => part.length < 2)) continue;
      // A typo needs a word that is not already a glossary word; else it is a correct term missing from the list.
      if (n > 1 && parts.every((part) => GLOSSARY_WORDS.has(part))) continue;
      for (const { term, limit } of FUZZY_TERMS.get(`${n}|${w[0]}`) ?? []) {
        if (n === 1 && COMMON_WORDS.has(w)) break;
        if (isInflection(w, term)) continue;
        const distance = distanceWithin(w, term, limit);
        if (distance > limit) continue;
        candidates.push({
          from,
          to: matchCase(from, term),
          index: start,
          end: last.end,
          explicit: false,
          distance,
        });
      }
    }
  }

  // Longest span wins, then explicit entries, then the closer match, then the earlier one.
  candidates.sort(
    (a, b) =>
      b.from.length - a.from.length ||
      Number(b.explicit) - Number(a.explicit) ||
      a.distance - b.distance ||
      a.index - b.index,
  );
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    if (exact.some(([a, b]) => a <= candidate.index && candidate.end <= b)) continue;
    if (!kept.some((other) => overlaps(candidate, other))) kept.push(candidate);
  }
  return kept
    .sort((a, b) => a.index - b.index)
    .map(({ from, to, index }) => ({ from, to, index }));
}

/** Applies one suggestion; if the text moved since, it falls back to the first match. */
export function applyCorrection(text: string, correction: Correction): string {
  const { from, to, index } = correction;
  if (text.slice(index, index + from.length) === from) {
    return text.slice(0, index) + to + text.slice(index + from.length);
  }
  const found = text.indexOf(from);
  if (found === -1) return text;
  return text.slice(0, found) + to + text.slice(found + from.length);
}

/**
 * Text with every suggestion applied, so tag matching still recognises a misspelled
 * term. It is for matching only and never changes stored text.
 */
export function normalizeTerms(text: string): string {
  let result = text;
  for (const correction of findCorrections(text).reverse()) {
    result = applyCorrection(result, correction);
  }
  return result;
}
