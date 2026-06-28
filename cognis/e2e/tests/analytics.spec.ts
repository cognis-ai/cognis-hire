import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

// P5 w4 slice 1 proof: a completed voice interview must produce sentiment/summary
// feedback that the recruiter UI can render. This drives the REAL path end-to-end
// against the live app, asserting at the API layer (the recruiter browser view is
// a pure render of the /api/get-call payload):
//
//   signed voice-bot webhook  →  voice-webhook route persists the response
//   →  fire-and-forget generateInterviewAnalytics (live cognis-smart LLM)
//   →  analytics persisted on the response
//   →  /api/get-call serves { callResponse, analytics } that CallInfo renders.
//
// API-level (no Clerk browser login) on purpose: get-call returns the exact data
// the UI binds to, and it sidesteps this env's mismatched Clerk keys. The
// transcript is substantive so the model returns a real score.

const INTERVIEW_ID = "cognis-demo-iv-1";
const ORG_ID = "27c5cbe1-5fdd-46f6-8ab9-2e83473a6ce1";

function buildSignedWebhook() {
  const sessionId = `e2e-analytics-${Date.now()}`;
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

test("completed interview generates sentiment/summary served to the recruiter view", async ({
  request,
}) => {
  const { sessionId, body, signature } = buildSignedWebhook();

  // 1. Fire the signed voice-bot webhook at the live app (real HMAC, real route).
  const res = await request.post("/api/voice-webhook", {
    headers: { "content-type": "application/json", "x-cognis-voice-signature": signature },
    data: body,
  });
  expect(res.status()).toBe(200);

  // 2. Analytics generation is async (a live LLM call). Poll the recruiter data
  //    route until the generated analytics land for this response.
  let analytics: Record<string, unknown> = {};
  let callResponse: Record<string, unknown> = {};
  await expect(async () => {
    const r = await request.post("/api/get-call", { data: { id: sessionId } });
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json?.analytics?.overallScore, "overallScore should be populated").toBeGreaterThan(0);
    analytics = json.analytics;
    callResponse = json.callResponse;
  }).toPass({ timeout: 90_000, intervals: [3000, 3000, 5000] });

  // 3. Assert the recruiter view will render real, qualitative feedback — not blanks.
  expect(typeof analytics.overallFeedback).toBe("string");
  expect((analytics.overallFeedback as string).length).toBeGreaterThan(20);
  expect((analytics.communication as { score?: number })?.score).toBeGreaterThanOrEqual(0);
  // Transcript is shaped for CallInfo's Agent:/User: renderer.
  expect(callResponse.transcript as string).toContain("Agent:");
  // recording_url is the slice-2 placeholder until the voice-bot captures audio.
  expect(callResponse.recording_url).toBeNull();
});
