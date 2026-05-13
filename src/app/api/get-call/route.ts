import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { getResponseByCallId, saveResponse } from "@/services/responses.service";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
  logger.info("get-call request received");
  const body = await req.json();

  const callDetails = await getResponseByCallId(body.id);
  if (!callDetails) {
    logger.error("Response row not found for callId");

    return NextResponse.json({ error: "call not found" }, { status: 404 });
  }

  let callResponse: unknown = callDetails.details;
  if (callDetails.isAnalysed) {
    return NextResponse.json(
      {
        callResponse,
        analytics: callDetails.analytics,
      },
      { status: 200 },
    );
  }
  const callOutput = await retell.call.retrieve(body.id);
  const interviewId = callDetails.interviewId ?? "";
  callResponse = callOutput;
  const endTimestamp = callOutput.end_timestamp ?? 0;
  const startTimestamp = callOutput.start_timestamp ?? 0;
  const duration = Math.round(endTimestamp / 1000 - startTimestamp / 1000);

  const payload = {
    callId: body.id,
    interviewId: interviewId,
    transcript: callOutput.transcript ?? "",
  };
  const result = await generateInterviewAnalytics(payload);

  const analytics = result.analytics;

  await saveResponse(
    {
      details: callOutput,
      is_analysed: true,
      duration: duration,
      analytics: analytics,
    },
    body.id,
  );

  logger.info("Call analysed successfully");

  return NextResponse.json(
    {
      callResponse,
      analytics,
    },
    { status: 200 },
  );
}
