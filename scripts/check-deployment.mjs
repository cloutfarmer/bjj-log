// Fail closed when a Vercel build does not identify the approved branch.
if (process.env.VERCEL === "1" && process.env.VERCEL_GIT_COMMIT_REF !== "prod") {
  console.error("Deployment refused: only the prod branch may deploy. Merge approved changes into prod first.");
  process.exit(1);
}
