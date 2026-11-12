import { createHash } from "node:crypto";

import type { JobName } from "./types";

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Job name and version are part of the hash so a prompt change regenerates saved output. */
export function hashInput(job: JobName, version: number, input: string): string {
  return hashText([job, String(version), input].join("\n"));
}
