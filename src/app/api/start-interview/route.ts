// Candidate-facing route: starts a Pipecat-powered AI interview session.
//
// Replaced /api/register-call (Retell) on 2026-05-16. The browser's
// PipecatClient connects to ws_url to stream audio.
//
// Auth model: NONE. The interview ID (a 21-char nanoid generated at
// create-interview time) IS the bearer cap — anyone with the link can take
// the interview. This matches upstream FoloUp's invariant. The link is
// distributed by the hiring org to specific candidates.

import { logger } from "@/lib/logger";
import { getInterviewer } from "@/services/interviewers.service";
import { getInterviewById } from "@/services/interviews.service";
import { type NextRequest, NextResponse } from "next/server";

const COGNIS_HIRE_BASE_PROMPT = `You are a Cognis Hire AI interviewer conducting a structured job-screening interview.

Style:
- Warm but professional. Conversational, not robotic.
- Ask one question at a time, wait for a full answer, then ask ONE follow-up.
- Don't pad with filler. Acknowledge briefly and move on.
- Keep your turns under 30 seconds spoken.

Hard rules:
- Never reveal the rubric or scoring criteria.
- Never make hiring commitments. You're a screener.
- Redirect politely once if off-topic; then move on.`;

function buildSystemPrompt(input: {
  candidateName: string;
  objective: string;
  questions: string;
  minutes: string;
}): string {
  return `${COGNIS_HIRE_BASE_PROMPT}

You are interviewing ${input.candidateName}.
Time budget: ${input.minutes} minutes.

Interview objective:
${input.objective}

Walk through these questions in order. Each gets ONE follow-up:
${input.questions}

Start by greeting ${input.candidateName} by name once, briefly state the purpose of the call, and ask the first question.

When you've covered all questions, ask "Is there anything you'd like to add before we wrap up?" and then close with "Thank you. The hiring team will review and follow up by email."`;
}

interface StartInterviewBody {
  interview_id: string;
  interviewer_id?: number;
  dynamic_data: {
    mins?: string;
    objective?: string;
    questions?: string;
    name?: string;
  };
}

interface VoiceBotStartResponse {
  session_id: string;
  // The bot returns a session-relative path + per-session token; we compose
  // the public wss:// URL and embed the token as ?t= for the browser.
  ws_path: string;
  ws_token: string;
}

export async function POST(req: NextRequest) {
  logger.info("start-interview request received");

  let body: StartInterviewBody;
  try {
    body = (await req.json()) as StartInterviewBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.interview_id) {
    return NextResponse.json({ error: "interview_id is required" }, { status: 400 });
  }

  // Verify interview exists + is active before spending voice-bot resources.
  const interview = await getInterviewById(body.interview_id);
  if (!interview || !interview.isActive) {
    return NextResponse.json({ error: "interview not found or inactive" }, { status: 404 });
  }

  // Voice-bot signup gate — the env vars below must be present in prod.
  const voiceBotUrl = process.env.VOICE_BOT_BASE_URL;
  const voiceBotSecret = process.env.VOICE_BOT_SHARED_SECRET;
  if (!voiceBotUrl || !voiceBotSecret) {
    logger.error("VOICE_BOT_BASE_URL or VOICE_BOT_SHARED_SECRET not configured");
    return NextResponse.json(
      { error: "interview service not configured — contact support" },
      { status: 503 },
    );
  }

  const systemPrompt = buildSystemPrompt({
    candidateName: body.dynamic_data?.name || "the candidate",
    objective: body.dynamic_data?.objective || interview.objective || "",
    questions: body.dynamic_data?.questions || "",
    minutes: body.dynamic_data?.mins || interview.timeDuration || "15",
  });

  // Optional interviewer (voice persona) lookup — Pipecat doesn't need a
  // pre-provisioned agent_id, just the Cartesia voice_id. We pass it via
  // metadata so the sidecar can override the default Cartesia voice if set.
  let voiceConfigId: string | undefined;
  if (body.interviewer_id) {
    const interviewer = await getInterviewer(body.interviewer_id);
    voiceConfigId = interviewer?.agentId ?? undefined;
  }

  try {
    const res = await fetch(`${voiceBotUrl.replace(/\/$/, "")}/start_bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cognis-Voice-Auth": voiceBotSecret,
      },
      body: JSON.stringify({
        interview_id: interview.id,
        // Tenant binding the bot stamps on the session (now required).
        org_id: interview.organizationId ?? "",
        system_prompt: systemPrompt,
        metadata: {
          interview_id: interview.id,
          organization_id: interview.organizationId ?? "",
          voice_config_id: voiceConfigId ?? "",
        },
      }),
      // Pipecat /start_bot is just a session-registration call (no model
      // inference), should return in <500ms locally.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "<no body>");
      logger.error(`voice-bot /start_bot returned ${res.status}: ${detail.slice(0, 200)}`);
      return NextResponse.json(
        { error: "failed to start interview" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as VoiceBotStartResponse;

    // Compose the public ws(s):// URL for the browser. The sidecar returns a
    // session-relative path + a per-session token; the token rides as ?t= and
    // is checked (constant-time) on the WS upgrade before accept().
    // VOICE_BOT_BASE_URL is http(s)://; convert scheme to ws(s)://.
    const publicWsBase = voiceBotUrl
      .replace(/^https/, "wss")
      .replace(/^http/, "ws")
      .replace(/\/$/, "");
    const publicWsUrl = `${publicWsBase}${data.ws_path}?t=${encodeURIComponent(data.ws_token)}`;

    return NextResponse.json(
      {
        session_id: data.session_id,
        ws_url: publicWsUrl,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error(`start-interview failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "failed to start interview" }, { status: 502 });
  }
}
