// Voice-bot webhook receiver. The Pipecat sidecar POSTs interview events
// here on call end. Verifies HMAC, persists the transcript locally, then
// forwards to Bridge /hire/webhook (raw-body mount outside the /v1 prefix)
// for billing + audit.
//
// Replaced /api/response-webhook (Retell signature) on 2026-05-16.
// Auth: HMAC-SHA256 of raw body bytes with VOICE_BOT_SHARED_SECRET, sent in
// X-Cognis-Voice-Signature. Constant-time compared.

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const TranscriptItemSchema = z.object({
  role: z.string(),
  content: z.string(),
  timestamp_seconds: z.number().optional(),
});

const VoiceWebhookSchema = z.object({
  event: z.literal("interview_completed"),
  session_id: z.string().min(1),
  transcript: z.array(TranscriptItemSchema).default([]),
  duration_seconds: z.number().nonnegative(),
  metadata: z
    .object({
      interview_id: z.string().optional(),
      organization_id: z.string().optional(),
      voice_config_id: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function forwardToBridge(payload: unknown, rawBytes: Buffer): Promise<void> {
  const bridgeUrl = process.env.BRIDGE_PUBLIC_URL;
  const sharedSecret = process.env.FOLOUP_ADMIN_SHARED_SECRET;
  if (!bridgeUrl || !sharedSecret) {
    logger.warn(
      "BRIDGE_PUBLIC_URL or FOLOUP_ADMIN_SHARED_SECRET missing — skipping Bridge forwarding",
    );
    return;
  }

  // Bridge expects HMAC over the body it receives. Re-sign with the
  // Bridge-side shared secret (different from the voice-bot's). Header
  // format matches Bridge's verifier: `X-Cognis-Signature: sha256=<hex>`.
  const bridgeSig = crypto
    .createHmac("sha256", sharedSecret)
    .update(rawBytes)
    .digest("hex");

  try {
    const res = await fetch(`${bridgeUrl.replace(/\/$/, "")}/hire/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cognis-Signature": `sha256=${bridgeSig}`,
      },
      body: rawBytes,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // A rejected forward is a lost billing/audit event — surface loudly.
      logger.error(`Bridge /hire/webhook returned ${res.status}`);
    }
  } catch (err) {
    // Don't fail the upstream webhook on Bridge unreachable — but a dropped
    // forward is a lost billing/audit event, so log at error level.
    logger.error(`Bridge forwarding failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

export async function POST(req: NextRequest) {
  const rawBytes = Buffer.from(await req.arrayBuffer());

  const presentedSig = req.headers.get("x-cognis-voice-signature") ?? "";
  const expectedSecret = process.env.VOICE_BOT_SHARED_SECRET ?? "";
  if (!expectedSecret) {
    logger.error("VOICE_BOT_SHARED_SECRET not set — refusing webhook");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const expectedSig = crypto
    .createHmac("sha256", expectedSecret)
    .update(rawBytes)
    .digest("hex");

  if (!presentedSig || !constantTimeEqual(presentedSig, expectedSig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = VoiceWebhookSchema.parse(JSON.parse(rawBytes.toString("utf8")));
  } catch (err) {
    logger.warn(`voice-webhook validation failed: ${err instanceof Error ? err.message : "?"}`);
    // Return 204 so the sidecar doesn't retry-storm us on payload drift —
    // matches the agent-bot precedent for resilience.
    return NextResponse.json({ status: "noop" }, { status: 204 });
  }

  const interviewId = parsed.metadata?.interview_id;
  logger.info(
    `interview_completed event for session=${parsed.session_id} interview=${interviewId ?? "?"}`,
  );

  // Persist transcript + duration. We key on session_id so the sidecar can
  // retry without producing duplicate rows; upsert pattern would be cleaner
  // but the Response table's PK is auto-increment, not session_id.
  if (interviewId) {
    try {
      // Cast through unknown — Zod's passthrough() schema produces a wider
      // type than Prisma's JsonValue accepts, but the runtime shape is
      // structurally identical (object of JSON-safe primitives).
      const details = {
        transcript: parsed.transcript,
        metadata: parsed.metadata ?? {},
      } as unknown as Prisma.InputJsonValue;

      await prisma.response.create({
        data: {
          interviewId,
          callId: parsed.session_id, // legacy column, repurposed as voice session id
          duration: Math.round(parsed.duration_seconds),
          details,
          isEnded: true,
        },
      });
    } catch (err) {
      // Likely an FK violation if interview was deleted — log and continue.
      logger.warn(
        `response persist failed for ${parsed.session_id}: ${err instanceof Error ? err.message : "?"}`,
      );
    }
  }

  // Fire-and-forget Bridge forwarding so we don't block the sidecar.
  void forwardToBridge(parsed, rawBytes);

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
