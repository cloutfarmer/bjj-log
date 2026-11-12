import { hashInput } from "./hash";

import type { Job, JobDeps, JobResult, ProviderResponse } from "./types";

/** Saved in place of an output when the model's reply could not be used. */
export const INVALID_KEY = "$invalidReplies";
/** One retry, in case the bad reply was a one-off. After that the input is not sent again. */
export const MAX_INVALID_REPLIES = 2;

function invalidReplies(output: unknown): number | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const count = (output as Record<string, unknown>)[INVALID_KEY];
  return typeof count === "number" ? count : null;
}

/**
 * The only path to a model. An unchanged input is served from the store, so repeat
 * calls cost no tokens. That includes an input whose replies were unusable: after
 * MAX_INVALID_REPLIES it fails at once with no call, until the input or the job version
 * changes. Errors and messages never carry note text or model output.
 */
export async function runJob<Args, Out>(
  job: Job<Args, Out>,
  scope: string,
  args: Args,
  deps: JobDeps,
): Promise<JobResult<Out>> {
  const { store, provider, model } = deps;
  const input = job.buildInput(args);
  const hash = hashInput(job.name, job.version, input);

  const saved = await store.getOutput(job.name, scope);
  let failures = 0;
  if (saved && saved.inputHash === hash) {
    const count = invalidReplies(saved.output);
    if (count === null) return { ok: true, output: saved.output as Out, cached: true, inputTokens: 0, outputTokens: 0 };
    if (count >= MAX_INVALID_REPLIES) return { ok: false, error: "invalid-output" };
    failures = count;
  }

  let response: ProviderResponse;
  try {
    response = await provider.complete({
      model,
      system: job.system,
      input,
      maxOutputTokens: job.maxOutputTokens,
    });
  } catch {
    return { ok: false, error: "provider" };
  }

  // Log before parsing: the tokens were spent even if the output is unusable. A failed
  // log must not throw away a reply that was paid for, so it never stops the run; the
  // usage table then misses that one call.
  await store
    .logRun({ job: job.name, model, inputTokens: response.inputTokens, outputTokens: response.outputTokens })
    .catch(() => undefined);

  const output = job.parseOutput(response.text, args);
  if (output === null) {
    await store.saveOutput(job.name, scope, hash, { [INVALID_KEY]: failures + 1 }).catch(() => undefined);
    return { ok: false, error: "invalid-output" };
  }

  await store.saveOutput(job.name, scope, hash, output);
  return {
    ok: true,
    output,
    cached: false,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
