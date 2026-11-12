import "server-only";

import type { JobName } from "./types";

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function apiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

/** A per-job override lets a different or local model be tried for one job at a time. */
export function modelFor(job: JobName): string {
  return process.env[`AI_MODEL_${job.toUpperCase()}`] || process.env.AI_MODEL || DEFAULT_MODEL;
}
