import { clerkSetup } from '@clerk/testing/playwright';

// Obtains a Clerk testing token for the instance configured via
// CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY (mapped in playwright.config.ts
// from the fork's .env.local). The token lets automated browsers pass the
// bot-detection on the live Clerk components.
export default async function globalSetup() {
  await clerkSetup();
}
