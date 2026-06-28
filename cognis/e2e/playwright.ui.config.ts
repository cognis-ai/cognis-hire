import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// HEADED UI e2e config for the analytics visual proof. No Clerk login / no
// storageState dependency — the recruiter call view under /interviews/* is not
// in proxy.ts's protected matcher, so the test navigates there directly.
// slowMo + headless:false make the run watchable.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const BASE_URL = process.env.HIRE_BASE_URL ?? "http://localhost:3011";

export default defineConfig({
  testDir: "./tests",
  testMatch: /-ui\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 150_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    headless: false,
    launchOptions: { slowMo: 350 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-headed" }],
});
