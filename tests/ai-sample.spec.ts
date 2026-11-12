import { expect, test } from "@playwright/test";
import { normalizeTerms } from "../lib/glossary";
import { JOBS } from "../lib/ai/jobs";
import { runJob } from "../lib/ai/run";
import { matchTags } from "../lib/ai/tagMatch";

import type { JobName, RunRecord, SavedOutput, Store } from "../lib/ai/types";

// A cost sample, not a regression test: it tags ten made-up notes through the real
// provider and prints what each one cost. It spends real tokens, so it runs only when
// asked for by name:
//
//   AI_SAMPLE=1 NODE_OPTIONS=--conditions=react-server npx playwright test tests/ai-sample.spec.ts
//
// ANTHROPIC_API_KEY must be set (playwright.config.ts loads .env.local). The
// react-server condition lets lib/ai/provider.ts load outside Next.js. It uses an
// in-memory store and no database, and every note here is made up.

const NOTES = [
  "Worked k guard entries from seated. Got to the backside once but lost the leg.",
  "Open mat. Kept getting stuck in half guard bottom, need a better knee shield.",
  "Drilled the knee cut against a knee shield. Coach says keep the underhook first.",
  "More K guard today, this time to the matrix. Timing was better.",
  "Heel hook defence from the saddle: hide the heel, clear the knee line, then turn.",
  "Taught the kids class. Reviewed the scissor sweep and hip bump sweep.",
  "No-gi class. Front headlock to guillotine, lost it when they circled out.",
  "Knee cut again, added the backstep when they frame on the hip.",
  "Rolled with a bigger partner and survived side control. Frames, then shrimp to guard.",
  "Tried de la hiva to berimbolo. Got the back twice. next: finish with the collar choke",
];

test("cost of tagging ten sample notes", async () => {
  test.skip(!process.env.AI_SAMPLE || !process.env.ANTHROPIC_API_KEY, "Set AI_SAMPLE=1 and ANTHROPIC_API_KEY to run.");

  // Imported here so an ordinary test run never loads the server-only provider.
  const { anthropicProvider } = await import("../lib/ai/provider");
  const provider = anthropicProvider(process.env.ANTHROPIC_API_KEY as string);
  const model = process.env.AI_MODEL || "claude-haiku-5-5";

  const outputs = new Map<string, SavedOutput>();
  const runs: RunRecord[] = [];
  const store: Store = {
    async getOutput(job: JobName, scope: string) { return outputs.get(`${job}|${scope}`) ?? null; },
    async saveOutput(job: JobName, scope: string, inputHash: string, output: unknown) { outputs.set(`${job}|${scope}`, { inputHash, output }); },
    async logRun(run: RunRecord) { runs.push(run); },
  };

  const tags: Record<string, string> = {};
  let matchedInCode = 0;
  let failed = 0;
  const lines: string[] = [];

  for (const [index, text] of NOTES.entries()) {
    const matches = matchTags(text, Object.keys(tags), normalizeTerms);
    if (matches.length) {
      matchedInCode++;
      lines.push(`${index + 1}. code match, no call -> ${matches.join(", ")}`);
      continue;
    }
    const result = await runJob(JOBS.tagNote, `sample-${index}`, { text, tags: Object.keys(tags) }, { store, provider, model });
    if (!result.ok) {
      failed++;
      lines.push(`${index + 1}. call failed (${result.error})`);
      continue;
    }
    for (const { tag, bucket } of result.output.tags) if (bucket) tags[tag] = bucket;
    const named = result.output.tags.map(({ tag, bucket }) => `${tag}${bucket ? ` (new, ${bucket})` : ""}`).join(", ") || "no tags";
    lines.push(`${index + 1}. model call, in ${result.inputTokens} out ${result.outputTokens} -> ${named}`);
  }

  const input = runs.reduce((sum, run) => sum + run.inputTokens, 0);
  const output = runs.reduce((sum, run) => sum + run.outputTokens, 0);
  console.log([
    `model ${model}`,
    ...lines,
    `notes ${NOTES.length}; matched in code ${matchedInCode}; model calls ${runs.length}; failed ${failed}`,
    `tokens in ${input}, out ${output}`,
  ].join("\n"));

  expect(matchedInCode + runs.length).toBe(NOTES.length);
});
