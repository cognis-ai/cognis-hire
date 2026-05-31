// Seeds the two stock interviewer personas (Lisa, Bob) for first-time
// dashboard load. Was Retell-based; rewired 2026-05-16 to Pipecat —
// no per-tenant external agent resource needs creating, we just stamp
// the local Interviewer rows with a Cartesia voice ID.

import { INTERVIEWERS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { requireOrgSession } from "@/lib/session-guard";
import { createInterviewer } from "@/services/interviewers.service";
import { type NextRequest, NextResponse } from "next/server";

// Default Cartesia voice IDs. Replaceable per-tenant later if/when we add
// voice customization in the dashboard. These match voice_id strings from
// Cartesia's public voice library — see https://play.cartesia.ai/voices.
// User should swap in the IDs they want from their Cartesia account.
const VOICE_LISA = "79a125e8-cd45-4c13-8a67-188112f4dd22"; // English-female default
const VOICE_BOB = "421b3369-f63f-4b03-8980-37a44df1d4e8"; // English-male default

export async function GET(req: NextRequest) {
  const session = await requireOrgSession();
  if (session instanceof NextResponse) return session;

  logger.info("create-interviewer request received");

  try {
    const lisa = await createInterviewer({
      agent_id: VOICE_LISA,
      ...INTERVIEWERS.LISA,
    });
    const bob = await createInterviewer({
      agent_id: VOICE_BOB,
      ...INTERVIEWERS.BOB,
    });

    return NextResponse.json({ newInterviewer: lisa, newSecondInterviewer: bob }, { status: 200 });
  } catch (error) {
    logger.error("Error creating interviewers");

    return NextResponse.json({ error: "Failed to create interviewers" }, { status: 500 });
  }
}
