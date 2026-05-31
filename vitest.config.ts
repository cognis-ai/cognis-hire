// Cognis test config. Scopes Vitest to the Cognis-specific glue only
// (the LiteLLM client wrapper and the voice-webhook HMAC verifier). Upstream
// FoloUp code is intentionally NOT covered here — we keep the fork-diff small.
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["src/**/__cognis_tests__/**/*.test.ts"],
  },
});
