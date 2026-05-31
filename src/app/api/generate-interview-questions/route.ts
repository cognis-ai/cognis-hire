import { cognisChat } from "@/lib/cognis-llm";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT, generateQuestionsPrompt } from "@/lib/prompts/generate-questions";
import { requireOrgSession } from "@/lib/session-guard";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await requireOrgSession();
  if (session instanceof NextResponse) return session;

  logger.info("generate-interview-questions request received");
  const body = await req.json();

  try {
    const baseCompletion = await cognisChat({
      model: "cognis-smart",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: generateQuestionsPrompt(body),
        },
      ],
      response_format: { type: "json_object" },
    });

    const basePromptOutput = baseCompletion.choices[0] || {};
    const content = basePromptOutput.message?.content;

    logger.info("Interview questions generated successfully");

    return NextResponse.json(
      {
        response: content,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error generating interview questions");

    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
