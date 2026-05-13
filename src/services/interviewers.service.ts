"use server";

// Interviewer data-access (Prisma).
//
// Functions are exported as Server Actions so that "use client" contexts and
// components can call them directly — Next.js handles the RPC transport.
// Server-side callers (API routes, other server actions) import them like
// normal async functions and skip the RPC roundtrip.

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Legacy callsites build snake_case payloads such as `{ agent_id, name,
// description, image, audio, empathy, exploration, rapport, speed }`. We
// translate to Prisma's camelCase shape here. Per project directive, no `any`:
// the legacy shape is `Record<string, unknown>` and we narrow per-field.
type LegacyInterviewerPayload = Record<string, unknown>;

function toPrismaInterviewerData(
  payload: LegacyInterviewerPayload,
): Prisma.InterviewerUncheckedCreateInput {
  const {
    agent_id,
    agentId,
    name,
    description,
    image,
    audio,
    empathy,
    exploration,
    rapport,
    speed,
    ...rest
  } = payload;

  // Defensive: drop `id` from rest so the autoincrement primary key isn't
  // accidentally overridden by stray legacy aliases.
  const { id: _restId, ...restWithoutId } = rest as { id?: unknown } & Record<string, unknown>;

  return {
    ...(restWithoutId as Prisma.InterviewerUncheckedCreateInput),
    agentId: ((agentId as string | undefined) ?? (agent_id as string | undefined)) as
      | string
      | undefined,
    name: name as string,
    description: description as string,
    image: image as string,
    audio: (audio as string | undefined) ?? undefined,
    empathy: empathy as number,
    exploration: exploration as number,
    rapport: rapport as number,
    speed: speed as number,
  };
}

export async function getAllInterviewers(_clientId = "") {
  try {
    return await prisma.interviewer.findMany({ orderBy: { id: "asc" } });
  } catch (error) {
    logger.error(`getAllInterviewers failed: ${(error as Error).message}`);

    return [];
  }
}

export async function createInterviewer(payload: LegacyInterviewerPayload) {
  try {
    const name = payload.name as string | undefined;
    const agentId =
      (payload.agentId as string | undefined) ?? (payload.agent_id as string | undefined);

    // Mirror the legacy uniqueness check (name + agent_id). If a match exists
    // we short-circuit with null rather than throwing a duplicate-key error.
    if (name) {
      const existing = await prisma.interviewer.findFirst({
        where: { name, agentId: agentId ?? null },
      });

      if (existing) {
        logger.error("An interviewer with this name already exists");

        return null;
      }
    }

    return await prisma.interviewer.create({
      data: toPrismaInterviewerData(payload),
    });
  } catch (error) {
    logger.error(`createInterviewer failed: ${(error as Error).message}`);

    return null;
  }
}

export async function getInterviewer(interviewerId: bigint | number) {
  try {
    const idNum = typeof interviewerId === "bigint" ? Number(interviewerId) : interviewerId;

    return await prisma.interviewer.findFirst({ where: { id: idNum } });
  } catch (error) {
    logger.error(`getInterviewer failed: ${(error as Error).message}`);

    return null;
  }
}
