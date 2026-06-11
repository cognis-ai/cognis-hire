// Server-side org response-quota enforcement (Gate 1 defect 8 / M9).
//
// Upstream FoloUp checks the free-plan response quota only in the dashboard's
// useEffect — an org past its limit keeps accepting candidate responses until
// an operator next loads the dashboard. These helpers are the server-side
// gate: /api/start-interview calls checkOrgResponseQuota() before
// provisioning a voice-bot session, and the createResponse server action
// calls checkInterviewResponseQuota() before inserting a row. The dashboard's
// client-side flip to `free_trial_over` stays as UX only.
//
// Semantics mirror the dashboard check exactly:
// - plan "free": blocked once total org responses >= allowedResponsesCount
//   (default 10, matching the dashboard's initial state)
// - plan "free_trial_over": always blocked
// - plan "pro" or unset plan: unlimited (the dashboard only checks "free")
// - org missing / interview without an org binding: allowed (legacy rows)
//
// Failure posture: fail OPEN on unexpected DB errors. Quota is a revenue
// control, not a security control — a DB blip must not become a 100%
// interview-start outage (cf. the M3 fail-closed lesson in the hire
// verification doc).

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const QUOTA_EXCEEDED = "QUOTA_EXCEEDED" as const;

const DEFAULT_FREE_RESPONSE_LIMIT = 10;

export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: typeof QUOTA_EXCEEDED;
      plan: string;
      responsesCount: number;
      allowedResponsesCount: number;
    };

/** Check whether an organization may accept another candidate response. */
export async function checkOrgResponseQuota(
  organizationId: string | null | undefined,
): Promise<QuotaDecision> {
  if (!organizationId) {
    return { allowed: true };
  }

  try {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { plan: true, allowedResponsesCount: true },
    });

    // Unknown org or a plan the dashboard doesn't gate (pro, unset) → allowed.
    if (!org || (org.plan !== "free" && org.plan !== "free_trial_over")) {
      return { allowed: true };
    }

    const limit = org.allowedResponsesCount ?? DEFAULT_FREE_RESPONSE_LIMIT;
    const responsesCount = await prisma.response.count({
      where: { interview: { organizationId } },
    });

    if (org.plan === "free_trial_over" || responsesCount >= limit) {
      return {
        allowed: false,
        code: QUOTA_EXCEEDED,
        plan: org.plan,
        responsesCount,
        allowedResponsesCount: limit,
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error(`checkOrgResponseQuota failed: ${(error as Error).message}`);

    return { allowed: true };
  }
}

/** Resolve an interview's org, then check that org's response quota. */
export async function checkInterviewResponseQuota(
  interviewId: string | null | undefined,
): Promise<QuotaDecision> {
  if (!interviewId) {
    return { allowed: true };
  }

  try {
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId },
      select: { organizationId: true },
    });

    return await checkOrgResponseQuota(interview?.organizationId);
  } catch (error) {
    logger.error(`checkInterviewResponseQuota failed: ${(error as Error).message}`);

    return { allowed: true };
  }
}
