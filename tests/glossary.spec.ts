import { expect, test } from "@playwright/test";
import { GLOSSARY, applyCorrection, findCorrections, normalizeTerms } from "../lib/glossary";

// Pure function tests: no server, browser, or database. Every sentence here is made up.

test("fixes a misspelled multi-word term and applies it", () => {
  const text = "Worked de la hiva sweeps today";
  const found = findCorrections(text);
  expect(found).toEqual([{ from: "de la hiva", to: "de la riva", index: 7 }]);
  expect(applyCorrection(text, found[0])).toBe("Worked de la riva sweeps today");
});

test("keeps a leading capital", () => {
  const [fix] = findCorrections("De la hiva was fun");
  expect(fix.from).toBe("De la hiva");
  expect(fix.to).toBe("De la riva");
});

test("explicit spellings are suggested", () => {
  expect(findCorrections("kimora from side control").map((c) => c.to)).toEqual(["kimura"]);
  expect(findCorrections("hit an arm bar late").map((c) => c.to)).toEqual(["armbar"]);
  expect(findCorrections("a gaurd pass drill").map((c) => c.to)).toEqual(["guard"]);
});

test("near misses outside the explicit map are suggested", () => {
  expect(findCorrections("tried an omoplatta").map((c) => c.to)).toEqual(["omoplata"]);
  expect(findCorrections("drilled the gogoplatta").map((c) => c.to)).toEqual(["gogoplata"]);
  expect(findCorrections("a de la hiba entry").map((c) => c.to)).toEqual(["de la riva"]);
});

test("correct text with several terms has no suggestions", () => {
  expect(findCorrections("de la riva to berimbolo, finished with a kimura from mount")).toEqual([]);
  expect(findCorrections("50/50 into a heel hook, then darce and anaconda")).toEqual([]);
});

test("ordinary English has no suggestions", () => {
  const sentences = [
    "I felt tired today but still drilled with a partner for most of the class.",
    "We worked on grips and timing, and I kept counting rounds to pace myself.",
    "My partner applied heavy mounted pressure and I could barely breathe.",
    "Triangles and turtles were the theme, plus a lot of American style wrestling.",
    "He twisted his wrist, so we took it easy and talked about the overall game plan.",
    "Sparred five rounds, then stretched, ate dinner and went to sleep early.",
    "The coach said to overlook the small mistakes and focus on position.",
  ];
  for (const sentence of sentences) expect(findCorrections(sentence)).toEqual([]);
  expect(findCorrections(sentences.join("\n"))).toEqual([]);
});

test("plurals and inflections of correct terms are left alone", () => {
  expect(findCorrections("triangles, armbars, kimuras, guillotines and heel hooks")).toEqual([]);
  expect(findCorrections("underhooks and whizzers and half guards")).toEqual([]);
});

test("a window never crosses a newline or a comma", () => {
  expect(findCorrections("de la,\nhiva")).toEqual([]);
  expect(findCorrections("de la\nhiva")).toEqual([]);
  expect(findCorrections("de la, hiva")).toEqual([]);
});

test("overlapping candidates produce one correction for the span", () => {
  const found = findCorrections("Reverse de la hiva again");
  expect(found).toEqual([{ from: "Reverse de la hiva", to: "Reverse de la riva", index: 0 }]);
});

test("from keeps the original inner whitespace", () => {
  const [fix] = findCorrections("de  la   hiva");
  expect(fix.from).toBe("de  la   hiva");
  expect(fix.to).toBe("de la riva");
});

test("applyCorrection falls back to the first occurrence, then to no change", () => {
  const fix = { from: "kimora", to: "kimura", index: 99 };
  expect(applyCorrection("a kimora here", fix)).toBe("a kimura here");
  expect(applyCorrection("nothing here", fix)).toBe("nothing here");
});

test("normalizeTerms fixes several terms and leaves the rest byte-identical", () => {
  const text = "Tried a kimora,  then   de la hiva\n  and 50/50 - fun!";
  expect(normalizeTerms(text)).toBe("Tried a kimura,  then   de la riva\n  and 50/50 - fun!");
  expect(normalizeTerms("nothing to fix here")).toBe("nothing to fix here");
});

test("glossary has no duplicates and every term is already correct", () => {
  expect(new Set(GLOSSARY).size).toBe(GLOSSARY.length);
  expect(GLOSSARY.length).toBeGreaterThanOrEqual(100);
  for (const term of GLOSSARY) {
    expect(term).toBe(term.toLowerCase());
    expect(findCorrections(term)).toEqual([]);
  }
});

test("suggested terms are canonical glossary entries", () => {
  const wrong = [
    "de la hiva",
    "dela riva",
    "kimora",
    "omaplata",
    "gullotine",
    "d'arce",
    "ezekial",
    "berimbollo",
    "toreando",
    "uchimata",
    "wizzer",
    "heal hook",
    "arm bar",
    "knee bar",
    "toehold",
  ];
  for (const word of wrong) {
    const [fix] = findCorrections(word);
    expect(GLOSSARY, word).toContain(fix.to);
  }
});

test("a correct term missing from the glossary is not turned into another term", () => {
  expect(findCorrections("we did ankle lock defense")).toEqual([]);
  expect(findCorrections("straight ankle locks in the gi")).toEqual([]);
  expect(normalizeTerms("ankle lock defense")).toBe("ankle lock defense");
});

test("a window made only of glossary words gets no fuzzy suggestion", () => {
  // "guard roll" is within edit distance 2 of "guard pull" but both words are correct.
  expect(findCorrections("a guard roll drill")).toEqual([]);
});

test("a window with a non-glossary word is still suggested", () => {
  expect(findCorrections("a de la hiba entry").map((c) => c.to)).toEqual(["de la riva"]);
  expect(findCorrections("tried an omoplatta").map((c) => c.to)).toEqual(["omoplata"]);
});

test("a 5,000 character note is fast", () => {
  const sentence = "Drilled the de la hiva sweep and a kimora, felt tired but sharp with grips. ";
  const text = sentence.repeat(Math.ceil(5000 / sentence.length));
  const start = performance.now();
  const found = findCorrections(text);
  expect(performance.now() - start).toBeLessThan(200);
  expect(found.length).toBeGreaterThan(0);
});
