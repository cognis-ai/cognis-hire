import { cognisChat } from "@/lib/cognis-llm";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT, createUserPrompt } from "@/lib/prompts/generate-insights";
import { getInterviewById, updateInterview } from "@/services/interviews.service";
import { getAllResponses } from "@/services/responses.service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  logger.info("generate-insights request received");
  const body = await req.json();

  const responses = await getAllResponses(body.interviewId);
  const interview = await getInterviewById(body.interviewId);

  if (!interview) {
    logger.error("Interview not found for generate-insights");

    return NextResponse.json({ error: "interview not found" }, { status: 404 });
  }

  let callSummaries = "";
  if (responses) {
    for (const response of responses) {
      // `details` is Postgres JSON → narrow before drilling in.
      const details =
        response.details && typeof response.details === "object" && !Array.isArray(response.details)
          ? (response.details as { call_analysis?: { call_summary?: string } })
          : null;
      callSummaries += details?.call_analysis?.call_summary ?? "";
    }
  }

  try {
    const prompt = createUserPrompt(
      callSummaries,
      interview.name ?? "",
      interview.objective ?? "",
      interview.description ?? "",
    );

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
    const insightsResponse = JSON.parse(content);

    await updateInterview({ insights: insightsResponse.insights }, body.interviewId);

    logger.info("Insights generated successfully");

    return NextResponse.json(
      {
        response: content,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error generating insights");

    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
