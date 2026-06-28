import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

// P5 w4 slice 1 — HEADED visual proof. Drives the real path end-to-end and shows
// the generated sentiment/summary rendering in the recruiter call view:
//
//   signed voice-bot webhook → analytics (live cognis-smart) → /api/get-call
//   → CallInfo renders "Overall Hiring Score" + feedback.
//
// Navigates straight to /interviews/* (NOT in the proxy.ts protected matcher —
// only /dashboard and /call are), so it needs no Clerk login. Run headed:
//   npx playwright test --config=playwright.ui.config.ts

const INTERVIEW_ID = "cognis-demo-iv-1";
const ORG_ID = "27c5cbe1-5fdd-46f6-8ab9-2e83473a6ce1";

function buildSignedWebhook() {
  const sessionId = `e2e-ui-${Date.now()}`;
  const body = JSON.stringify({
    event: "interview_completed",
    session_id: sessionId,
    transcript: [
      { role: "assistant", content: "Tell me about a hard production bug you fixed." },
      {
        role: "user",
        content:
          "I traced a race condition in our payment webhook to a missing idempotency key. " +
          "I added a Redis-backed lock and dedupe, wrote a regression test, and it never recurred.",
      },
      { role: "assistant", content: "How did you communicate it to the team?" },
      { role: "user", content: "I wrote a short incident doc, demoed the fix in standup, and added a runbook." },
    ],
    duration_seconds: 190,
    metadata: { interview_id: INTERVIEW_ID, organization_id: ORG_ID },
  });

  const secret = process.env.VOICE_BOT_SHARED_SECRET ?? "";
  expect(secret, "VOICE_BOT_SHARED_SECRET must be loaded from .env.local").not.toBe("");
  const signature = crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");

  return { sessionId, body, signature };
}

test("recruiter sees AI sentiment/summary after an interview completes", async ({ page, request }) => {
  const { sessionId, body, signature } = buildSignedWebhook();

  // 1. Fire the signed voice-bot webhook (real HMAC) at the live app.
  const res = await request.post("/api/voice-webhook", {
    headers: { "content-type": "application/json", "x-cognis-voice-signature": signature },
    data: body,
  });
  expect(res.status()).toBe(200);

  // 2. Wait for the async (live LLM) analytics to land so the UI has data.
  await expect(async () => {
    const r = await request.post("/api/get-call", { data: { id: sessionId } });
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json?.analytics?.overallScore, "overallScore populated").toBeGreaterThan(0);
  }).toPass({ timeout: 90_000, intervals: [2000, 2000, 3000] });

  // 3. Open the recruiter call view (no login needed) and watch it render.
  await page.goto(`/interviews/${INTERVIEW_ID}?call=${sessionId}`);
  await expect(page.getByText("Overall Hiring Score")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("General Summary")).toBeVisible();
  await expect(page.getByText(/Feedback:/i).first()).toBeVisible();

  // Pause so a human can read the rendered analytics before the run ends.
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "playwright-report/p5w4-hire-analytics-ui.png", fullPage: true });
});
