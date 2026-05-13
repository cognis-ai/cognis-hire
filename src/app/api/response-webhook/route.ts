import { logger } from "@/lib/logger";
import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";
import { Retell } from "retell-sdk";
import { RetellWebhookSchema } from "./schema";

const apiKey = process.env.RETELL_API_KEY || "";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (
    !Retell.verify(
      JSON.stringify(req.body),
      apiKey,
      req.headers.get("x-retell-signature") as string,
    )
  ) {
    console.error("Invalid signature");

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Retell webhook body. Zod-parsed with `.passthrough()` so we only fail on
  // the fields we actually read (`event` and `call.call_id`). On parse
  // failure we log + return 200 to match our agent-bot precedent — Retell
  // retries on non-2xx and a silent drop is preferable to a noisy retry
  // storm when their payload schema drifts.
  const parsed = RetellWebhookSchema.safeParse(await req.json());
  if (!parsed.success) {
    logger.warn(`Retell webhook payload failed validation: ${parsed.error.message}`);

    return NextResponse.json({ status: 204 });
  }

  const { event, call } = parsed.data;

  switch (event) {
    case "call_started":
      console.log("Call started event received", call.call_id);
      break;
    case "call_ended":
      console.log("Call ended event received", call.call_id);
      break;
    case "call_analyzed": {
      await axios.post("/api/get-call", {
        id: call.call_id,
      });
      console.log("Call analyzed event received", call.call_id);
      break;
    }
    default:
      console.log("Received an unknown event:", event);
  }

  // Acknowledge the receipt of the event
  return NextResponse.json({ status: 204 });
}
