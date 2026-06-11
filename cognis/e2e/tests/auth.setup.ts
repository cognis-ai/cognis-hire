import fs from "node:fs";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, E2E_EMAIL } from "./helpers";

// Produces a logged-in storageState reused by the authenticated flows.
// Login itself is asserted here AND independently in auth.spec.ts (anon
// redirect + UI happy path + logout), so this isn't the only coverage.
setup("authenticate via Clerk as the e2e user", async ({ page }) => {
  await setupClerkTestingToken({ page });

  // /sign-in is the in-app Clerk page (ClerkJS loads there); the helper needs
  // a page on the app origin with Clerk available.
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "email_code", identifier: E2E_EMAIL },
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "My Interviews" })).toBeVisible();

  fs.mkdirSync(".auth", { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
