import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Cognis Hire e2e — drives the LIVE fork at :3091 (container cognis-hire-1).
// Clerk keys come from the fork's own .env.local (NEVER committed here);
// @clerk/testing reads CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY, so map the
// Next-style names onto the ones the testing helper expects.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
// CLERK_SECRET_KEY is already named correctly in .env.local.

const BASE_URL = process.env.HIRE_BASE_URL ?? "http://localhost:3091";

export default defineConfig({
  testDir: "./tests",
  // Auth state is shared via storageState produced by the auth setup project,
  // so flows don't re-login on every test. Login itself is tested explicitly.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./global.setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
