"use server";

// Feedback data-access (Prisma).
//
// Server Action: callers in "use client" components invoke directly; Next.js
// handles the RPC transport.

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { FeedbackData } from "@/types/response";

export async function submitFeedback(feedbackData: FeedbackData) {
  try {
    const row = await prisma.feedback.create({
      data: {
        interviewId: feedbackData.interview_id,
        satisfaction: feedbackData.satisfaction,
        feedback: feedbackData.feedback,
        email: feedbackData.email,
      },
    });

    return [row];
  } catch (error) {
    logger.error(`submitFeedback failed: ${(error as Error).message}`);
    throw error;
  }
}
