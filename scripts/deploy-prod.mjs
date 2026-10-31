import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("branch", "--show-current") !== "prod") {
  console.error("Deployment refused: switch to prod after merging approved changes.");
  process.exit(1);
}
if (git("status", "--porcelain")) {
  console.error("Deployment refused: commit or stash workspace changes first.");
  process.exit(1);
}
// Fetch the release ref so a stale local branch cannot be deployed accidentally.
execFileSync("git", ["fetch", "origin", "prod"], { stdio: "inherit" });
if (git("rev-parse", "HEAD") !== git("rev-parse", "FETCH_HEAD")) {
  console.error("Deployment refused: local prod must match origin/prod. Review and sync it first.");
  process.exit(1);
}
const result = spawnSync("npx", ["--yes", "vercel@65.9.0", "deploy", "--prod", "--scope", "bjj-log"], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
