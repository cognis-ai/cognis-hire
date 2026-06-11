"use server";

// Response data-access (Prisma).
//
// Functions are exported as Server Actions so that "use client" contexts and
// components can call them directly — Next.js handles the RPC transport.
// Server-side callers (API routes, other server actions) import them like
// normal async functions and skip the RPC roundtrip.

import { checkInterviewResponseQuota } from "@/lib/cognis/quota";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Legacy callsites build snake_case payloads such as
// `{ interview_id, call_id, email, name, is_viewed, is_ended, is_analysed,
//   candidate_status, tab_switch_count, details, analytics, duration }`.
// We accept that shape and translate to Prisma's camelCase create/update
// input below. Per project directive, no `any`.
type LegacyResponsePayload = Record<string, unknown>;

function toPrismaResponseCreateData(
  payload: LegacyResponsePayload,
): Prisma.ResponseUncheckedCreateInput {
  const {
    interview_id,
    interviewId,
    name,
    email,
    call_id,
    callId,
    candidate_status,
    candidateStatus,
    duration,
    details,
    analytics,
    is_analysed,
    isAnalysed,
    is_ended,
    isEnded,
    is_viewed,
    isViewed,
    tab_switch_count,
    tabSwitchCount,
    ...rest
  } = payload;

  // Defensive: ensure the autoincrement primary key isn't clobbered by rest.
  const { id: _restId, ...restWithoutId } = rest as { id?: unknown } & Record<string, unknown>;

  return {
    ...(restWithoutId as Prisma.ResponseUncheckedCreateInput),
    interviewId: ((interviewId as string | undefined) ?? (interview_id as string | undefined)) as
      | string
      | undefined,
    name: (name as string | null | undefined) ?? undefined,
    email: (email as string | null | undefined) ?? undefined,
    callId: ((callId as string | undefined) ?? (call_id as string | undefined)) as
      | string
      | undefined,
    candidateStatus: ((candidateStatus as string | undefined) ??
      (candidate_status as string | undefined)) as string | undefined,
    duration: (duration as number | undefined) ?? undefined,
    details: (details as Prisma.InputJsonValue | undefined) ?? undefined,
    analytics: (analytics as Prisma.InputJsonValue | undefined) ?? undefined,
    isAnalysed: ((isAnalysed as boolean | undefined) ?? (is_analysed as boolean | undefined)) as
      | boolean
      | undefined,
    isEnded: ((isEnded as boolean | undefined) ?? (is_ended as boolean | undefined)) as
      | boolean
      | undefined,
    isViewed: ((isViewed as boolean | undefined) ?? (is_viewed as boolean | undefined)) as
      | boolean
      | undefined,
    tabSwitchCount: ((tabSwitchCount as number | undefined) ??
      (tab_switch_count as number | undefined)) as number | undefined,
  };
}

function toPrismaResponseUpdateData(
  payload: LegacyResponsePayload,
): Prisma.ResponseUncheckedUpdateInput {
  // Reuse the create-mapper. Prisma ignores undefined values on update so the
  // create-shape doubles as a partial-update shape.
  const data = toPrismaResponseCreateData(payload);
  // biome-ignore lint/performance/noDelete: dropping any stray id off the patch
  delete (data as Record<string, unknown>).id;

  return data;
}

export async function createResponse(payload: LegacyResponsePayload) {
  try {
    const data = toPrismaResponseCreateData(payload);

    // Server-side plan-quota gate (Gate 1 defect 8 / M9). The primary block
    // is /api/start-interview (no session is provisioned at the limit); this
    // is defense-in-depth because createResponse is a Server Action that
    // "use client" contexts call directly.
    const quota = await checkInterviewResponseQuota(data.interviewId ?? null);
    if (!quota.allowed) {
      logger.warn(
        `createResponse blocked by quota: interview=${data.interviewId} ` +
          `responses=${quota.responsesCount}/${quota.allowedResponsesCount}`,
      );

      return { error: quota.code };
    }

    const row = await prisma.response.create({
      data,
      select: { id: true },
    });

    return row.id;
  } catch (error) {
    logger.error(`createResponse failed: ${(error as Error).message}`);

    return [];
  }
}

export async function saveResponse(payload: LegacyResponsePayload, call_id: string) {
  try {
    return await prisma.response.updateMany({
      where: { callId: call_id },
      data: toPrismaResponseUpdateData(payload),
    });
  } catch (error) {
    logger.error(`saveResponse failed: ${(error as Error).message}`);

    return [];
  }
}

export async function updateResponse(payload: LegacyResponsePayload, call_id: string) {
  try {
    return await prisma.response.updateMany({
      where: { callId: call_id },
      data: toPrismaResponseUpdateData(payload),
    });
  } catch (error) {
    logger.error(`updateResponse failed: ${(error as Error).message}`);

    return [];
  }
}

export async function getAllResponses(interviewId: string) {
  try {
    // Upstream filter: response rows for the interview where the call is
    // ended AND (details is null OR details->call_analysis is not null).
    // Translates to Prisma: isEnded = true AND (details IS NULL OR
    // details ? 'call_analysis').
    return await prisma.response.findMany({
      where: {
        interviewId,
        isEnded: true,
        OR: [
          { details: { equals: Prisma.DbNull } },
          {
            details: {
              path: ["call_analysis"],
              not: Prisma.DbNull,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error(`getAllResponses failed: ${(error as Error).message}`);

    return [];
  }
}

export async function getResponseCountByOrganizationId(organizationId: string): Promise<number> {
  try {
    // Counts responses across every interview belonging to the org.
    // Upstream's Supabase call did a nested-relation count on the
    // `interview` table; the user-facing intent is the total responses for
    // the org, which is what this expresses cleanly in Prisma.
    return await prisma.response.count({
      where: { interview: { organizationId } },
    });
  } catch (error) {
    logger.error(`getResponseCountByOrganizationId failed: ${(error as Error).message}`);

    return 0;
  }
}

export async function getAllEmails(interviewId: string) {
  try {
    return await prisma.response.findMany({
      where: { interviewId },
      select: { email: true },
    });
  } catch (error) {
    logger.error(`getAllEmails failed: ${(error as Error).message}`);

    return [];
  }
}

export async function getResponseByCallId(id: string) {
  try {
    return await prisma.response.findFirst({ where: { callId: id } });
  } catch (error) {
    logger.error(`getResponseByCallId failed: ${(error as Error).message}`);

    return null;
  }
}

export async function deleteResponse(id: string) {
  try {
    return await prisma.response.deleteMany({ where: { callId: id } });
  } catch (error) {
    logger.error(`deleteResponse failed: ${(error as Error).message}`);

    return [];
  }
}
