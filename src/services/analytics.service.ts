"use server";

import { cognisChat } from "@/lib/cognis-llm";
import { SYSTEM_PROMPT, getInterviewAnalyticsPrompt } from "@/lib/prompts/analytics";
import { getInterviewById } from "@/services/interviews.service";
import { getResponseByCallId } from "@/services/responses.service";
import type { Question } from "@/types/interview";
import type { Analytics } from "@/types/response";

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  try {
    const response = await getResponseByCallId(callId);
    const interview = await getInterviewById(interviewId);

    if (response?.analytics) {
      return { analytics: response.analytics as unknown as Analytics, status: 200 };
    }

    // `details` is JSON from Postgres; narrow before reading transcript.
    const details =
      response && typeof response.details === "object" && response.details !== null
        ? (response.details as { transcript?: string })
        : null;
    const interviewTranscript = transcript || details?.transcript || "";
    // `interview.questions` is JSON from Postgres → narrow to Question[] for
    // template-rendering. The legacy upstream stored an array of objects
    // shaped like Question; preserve that contract.
    const questions: Question[] = Array.isArray(interview?.questions)
      ? (interview?.questions as unknown as Question[])
      : [];
    const mainInterviewQuestions = questions
      .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
      .join("\n");

    const prompt = getInterviewAnalyticsPrompt(interviewTranscript, mainInterviewQuestions);

    const baseCompletion = await cognisChat({
      model: "cognis-smart",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const basePromptOutput = baseCompletion.choices[0] || {};
    const content = basePromptOutput.message?.content || "";
    const analyticsResponse = JSON.parse(content);

    analyticsResponse.mainInterviewQuestions = questions.map((q: Question) => q.question);

    return { analytics: analyticsResponse, status: 200 };
  } catch (error) {
    console.error("Error in Cognis LLM request:", error);

    return { error: "internal server error", status: 500 };
  }
};
