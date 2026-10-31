import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    // Do not persist traces containing the journal password or notes.
    trace: "off",
  },
});
