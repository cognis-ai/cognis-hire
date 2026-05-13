"use server";

// Interview data-access (Prisma).
//
// Functions are exported as Server Actions so that "use client" contexts and
// components can call them directly — Next.js handles the RPC transport.
// Server-side callers (API routes, other server actions) import them like
// normal async functions and skip the RPC roundtrip.

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Snake_case → camelCase column rename map for the payload shapes that
// upstream FoloUp constructs at the call site (e.g., create-interview
// route builds `{ id, url, readable_slug, ... }`). We accept the legacy
// snake_case keys to avoid touching every caller, and translate here.
type LegacyInterviewPayload = Record<string, unknown>;

function toPrismaInterviewData(
  payload: LegacyInterviewPayload,
): Prisma.InterviewUncheckedCreateInput {
  // The destructure tolerates any extra keys callers happen to pass.
  // We funnel every known column (snake_case AND camelCase) out of `payload`
  // so they don't leak into `...rest` and clobber the typed fields below.
  const {
    id,
    name,
    description,
    objective,
    organization_id,
    user_id,
    interviewer_id,
    is_active,
    is_anonymous,
    is_archived,
    logo_url,
    theme_color,
    url,
    readable_slug,
    questions,
    quotes,
    insights,
    respondents,
    question_count,
    response_count,
    time_duration,
    organizationId,
    userId,
    interviewerId,
    isActive,
    isAnonymous,
    isArchived,
    logoUrl,
    themeColor,
    readableSlug,
    questionCount,
    responseCount,
    timeDuration,
    ...rest
  } = payload;

  // Pull `id` out of rest as well — Prisma's `InterviewUncheckedCreateInput`
  // also accepts `id`, so the explicit field below would be overwritten by
  // the rest spread if any legacy caller passed it via a duplicate alias.
  const { id: _restId, ...restWithoutId } = rest as { id?: unknown } & Record<string, unknown>;

  return {
    // Spread `restWithoutId` FIRST so the explicit named fields below take
    // precedence over any stray keys (defensive against unknown legacy aliases).
    ...(restWithoutId as Prisma.InterviewUncheckedCreateInput),
    id: id as string,
    name: (name as string | null | undefined) ?? null,
    description: (description as string | null | undefined) ?? null,
    objective: (objective as string | null | undefined) ?? null,
    organizationId:
      (organizationId as string | undefined) ?? (organization_id as string | undefined),
    userId: (userId as string | undefined) ?? (user_id as string | undefined),
    interviewerId: (interviewerId as number | undefined) ?? (interviewer_id as number | undefined),
    isActive: (isActive as boolean | undefined) ?? (is_active as boolean | undefined),
    isAnonymous: (isAnonymous as boolean | undefined) ?? (is_anonymous as boolean | undefined),
    isArchived: (isArchived as boolean | undefined) ?? (is_archived as boolean | undefined),
    logoUrl: (logoUrl as string | undefined) ?? (logo_url as string | undefined),
    themeColor: (themeColor as string | undefined) ?? (theme_color as string | undefined),
    url: url as string | undefined,
    readableSlug: (readableSlug as string | undefined) ?? (readable_slug as string | undefined),
    questions: (questions as Prisma.InputJsonValue | undefined) ?? undefined,
    quotes: (quotes as Prisma.InputJsonValue[] | undefined) ?? undefined,
    insights: (insights as string[] | undefined) ?? undefined,
    respondents: (respondents as string[] | undefined) ?? undefined,
    questionCount: (questionCount as number | undefined) ?? (question_count as number | undefined),
    responseCount: (responseCount as number | undefined) ?? (response_count as number | undefined),
    timeDuration: (timeDuration as string | undefined) ?? (time_duration as string | undefined),
  };
}

function toPrismaInterviewUpdate(
  payload: LegacyInterviewPayload,
): Prisma.InterviewUncheckedUpdateInput {
  // For updates we drop `id` and treat every key as optional. Reuse the
  // create-mapper and let Prisma ignore undefined values.
  const data = toPrismaInterviewData(payload);
  // biome-ignore lint/performance/noDelete: dropping the id field from the patch is intentional
  delete (data as Record<string, unknown>).id;
  return data;
}

export async function getAllInterviews(userId: string, organizationId: string) {
  try {
    return await prisma.interview.findMany({
      where: {
        OR: [{ organizationId }, { userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error(`getAllInterviews failed: ${(error as Error).message}`);
    return [];
  }
}

export async function getInterviewById(id: string) {
  try {
    return await prisma.interview.findFirst({
      where: {
        OR: [{ id }, { readableSlug: id }],
      },
    });
  } catch (error) {
    logger.error(`getInterviewById failed: ${(error as Error).message}`);
    return null;
  }
}

export async function updateInterview(payload: LegacyInterviewPayload, id: string) {
  try {
    return await prisma.interview.update({
      where: { id },
      data: toPrismaInterviewUpdate(payload),
    });
  } catch (error) {
    logger.error(`updateInterview failed: ${(error as Error).message}`);
    return null;
  }
}

export async function deleteInterview(id: string) {
  try {
    return await prisma.interview.delete({ where: { id } });
  } catch (error) {
    logger.error(`deleteInterview failed: ${(error as Error).message}`);
    return null;
  }
}

export async function createInterview(payload: LegacyInterviewPayload) {
  try {
    return await prisma.interview.create({
      data: toPrismaInterviewData(payload),
    });
  } catch (error) {
    logger.error(`createInterview failed: ${(error as Error).message}`);
    return null;
  }
}

export async function deactivateInterviewsByOrgId(organizationId: string) {
  try {
    await prisma.interview.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });
  } catch (error) {
    logger.error(`deactivateInterviewsByOrgId failed: ${(error as Error).message}`);
  }
}
