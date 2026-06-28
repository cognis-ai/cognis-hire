import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

// API-level e2e config (no Clerk browser login / no storageState dependency).
// Used for proofs that drive the live app through its HTTP routes — e.g. the
// voice-bot webhook → analytics → get-call path. Defaults baseURL to the
// host dev server on :3011 (override with HIRE_BASE_URL).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const BASE_URL = process.env.HIRE_BASE_URL ?? "http://localhost:3011";

export default defineConfig({
  testDir: "./tests",
  testMatch: /analytics\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: BASE_URL },
  projects: [{ name: "api" }],
});
