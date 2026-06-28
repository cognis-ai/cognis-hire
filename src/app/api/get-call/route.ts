// Per-response detail fetch for the recruiter call view (CallInfo POSTs here
// with the call/session id). Returns the response's generated analytics plus a
// CallData-shaped object the component renders (transcript + recording slot).
//
// Restores the data route CallInfo has always called (it was a Retell endpoint
// upstream; the Retell→Pipecat swap dropped it). Without this route the per-call
// "General Summary" panel renders blank even when analytics exist in the DB.
// `recording_url` stays null until the voice-bot captures + uploads audio.

import { logger } from "@/lib/logger";
import { getResponseByCallId } from "@/services/responses.service";
import { type NextRequest, NextResponse } from "next/server";

type TranscriptTurn = { role: string; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: unknown };
    const id = body?.id;
    if (typeof id !== "string" || id.length === 0) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }

    const response = await getResponseByCallId(id);
    if (!response) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // `details` is Postgres JSON; narrow before reading the transcript turns.
    const details =
      response.details && typeof response.details === "object"
        ? (response.details as { transcript?: TranscriptTurn[]; recording_url?: string | null })
        : null;
    const turns: TranscriptTurn[] = Array.isArray(details?.transcript) ? details.transcript : [];

    // CallInfo's replaceAgentAndUser() maps "Agent:"/"User:" prefixes onto the
    // AI-interviewer / candidate display names, so emit that legacy shape.
    const transcript = turns
      .map((t) => `${t.role === "user" ? "User" : "Agent"}: ${t.content}`)
      .join("\n");

    const callResponse = {
      transcript,
      // Presigned recording URL from the voice-bot (null until audio is captured).
      recording_url: details?.recording_url ?? null,
      duration: response.duration ?? 0,
    };

    return NextResponse.json({ callResponse, analytics: response.analytics ?? null });
  } catch (err) {
    logger.error(`get-call failed: ${err instanceof Error ? err.message : "?"}`);

    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
