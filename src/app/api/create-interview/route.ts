import { logger } from "@/lib/logger";
import { requireOrgSession } from "@/lib/session-guard";
import { createInterview } from "@/services/interviews.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request) {
  const session = await requireOrgSession();
  if (session instanceof NextResponse) return session;

  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;

    let readableSlug = null;
    if (body.organizationName) {
      const interviewNameSlug = payload.name?.toLowerCase().replace(/\s/g, "-");
      const orgNameSlug = body.organizationName?.toLowerCase().replace(/\s/g, "-");
      readableSlug = `${orgNameSlug}-${interviewNameSlug}`;
    }

    // organizationId comes from the verified session, NOT from the request
    // body — body.organizationId would let any signed-in user create
    // interviews in another tenant's org.
    const newInterview = await createInterview({
      ...payload,
      organization_id: session.orgId,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
    });

    logger.info("Interview created successfully");

    return NextResponse.json({ response: "Interview created successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
