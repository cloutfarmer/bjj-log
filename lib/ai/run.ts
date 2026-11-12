import { hashInput } from "./hash";

import type { Job, JobDeps, JobResult, ProviderResponse } from "./types";

/**
 * The only path to a model. An unchanged input is served from the store, so repeat
 * calls cost no tokens. Errors and messages never carry note text or model output.
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
  if (saved && saved.inputHash === hash) {
    return { ok: true, output: saved.output as Out, cached: true, inputTokens: 0, outputTokens: 0 };
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

  // Log before parsing: the tokens were spent even if the output is unusable.
  await store.logRun({
    job: job.name,
    model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  const output = job.parseOutput(response.text, args);
  if (output === null) return { ok: false, error: "invalid-output" };

  await store.saveOutput(job.name, scope, hash, output);
  return {
    ok: true,
    output,
    cached: false,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
