export type JobName =
  | "tagNote"
  | "cleanNote"
  | "tagCleanup"
  | "dailyBrief"
  | "weeklySummary"
  | "monthlyRecap";

export interface ProviderRequest {
  model: string;
  system: string;
  input: string;
  maxOutputTokens: number;
}

export interface ProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Provider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface SavedOutput {
  inputHash: string;
  output: unknown;
}

export interface RunRecord {
  job: JobName;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Store {
  getOutput(job: JobName, scope: string): Promise<SavedOutput | null>;
  saveOutput(job: JobName, scope: string, inputHash: string, output: unknown): Promise<void>;
  logRun(run: RunRecord): Promise<void>;
}

export interface Job<Args, Out> {
  name: JobName;
  /** Bump when the prompt or output shape changes, so saved outputs are regenerated. */
  version: number;
  system: string;
  maxOutputTokens: number;
  buildInput(args: Args): string;
  /** Returns null when the model's text is not valid output for these args. */
  parseOutput(text: string, args: Args): Out | null;
}

export type JobResult<Out> =
  | { ok: true; output: Out; cached: boolean; inputTokens: number; outputTokens: number }
  | { ok: false; error: "provider" | "invalid-output" };

export interface JobDeps {
  store: Store;
  provider: Provider;
  model: string;
}
