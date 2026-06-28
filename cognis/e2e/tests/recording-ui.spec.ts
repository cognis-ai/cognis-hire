import { expect, test } from "@playwright/test";

// P5 w4 slice 2 — HEADED proof that an interview recording is delivered and
// playable in the recruiter view. The recording was uploaded to private MinIO
// by the real voice-bot recorder and its presigned URL delivered via the
// interview-completed webhook (orchestrated by the harness before this runs).
//
// Navigates straight to /interviews/* (not in proxy.ts's protected matcher),
// so no Clerk login. REC_SESSION is the call/session id to open.
const INTERVIEW_ID = "cognis-demo-iv-1";
const SESSION = process.env.REC_SESSION ?? "";

test("recruiter can see & play the interview recording", async ({ page, request }) => {
  expect(SESSION, "REC_SESSION env must be set by the harness").not.toBe("");

  await page.goto(`/interviews/${INTERVIEW_ID}?call=${SESSION}`);

  // The recording card + audio player render once get-call returns a recording_url.
  await expect(page.getByText("Interview Recording")).toBeVisible({ timeout: 30_000 });
  const audio = page.locator("audio");
  await expect(audio).toBeVisible();

  // Prove the rendered src actually serves the recording (presigned, private bucket).
  const src = await audio.getAttribute("src");
  expect(src, "audio element should carry the presigned recording URL").toBeTruthy();
  const rec = await request.get(src as string);
  expect(rec.status()).toBe(200);
  expect(rec.headers()["content-type"]).toContain("audio/wav");

  // Pause so a human can see the player, then capture proof.
  await page.waitForTimeout(7000);
  await page.screenshot({ path: "playwright-report/p5w4-hire-recording-ui.png", fullPage: true });
});
