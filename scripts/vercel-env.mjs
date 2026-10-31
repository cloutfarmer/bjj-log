// Run only when ready to configure the linked Vercel project's production secrets.
// Values travel through stdin, never shell arguments or terminal output.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
const keys = ["DATABASE_URL", "BJJ_PASSWORD", "BJJ_SESSION_SECRET"];
for (const key of keys) {
  if (!process.env[key]) throw new Error(`${key} is missing from the local environment.`);
}
if (process.env.BJJ_PASSWORD.length < 12) throw new Error("Choose a strong BJJ_PASSWORD of at least 12 characters before public deployment.");
if (process.env.BJJ_SESSION_SECRET.length < 32) throw new Error("BJJ_SESSION_SECRET must contain at least 32 characters.");
for (const key of keys) {
  const result = spawnSync("npx", ["--yes", "vercel@latest", "env", "add", key,
    "--environment", "production", "--sensitive", "--yes", "--force", "--scope", project.orgId], {
    input: process.env[key], encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`Vercel could not store ${key}. Check authentication and project access; no secret values were logged.`);
  console.log(`Configured ${key} as a production secret.`);
}
