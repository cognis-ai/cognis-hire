// POST /api/admin/users — Bridge-issued admin user creation.
//
// Body: { cognis_org_id, organization_id, email, clerk_user_id? }
// Returns { id, email, organizationId, ssoHandoffToken } shaped for
// FoloupClient.createAdminUser. The ssoHandoffToken is HS256-signed with
// FOLOUP_ADMIN_SHARED_SECRET; Bridge holds it until the operator clicks
// "Open Hire" in the portal, at which point it hits /api/auth/sso-redeem.

import { type FoloupUser, createUserBodySchema } from "@/lib/admin-schemas";
import { requireAdminAuth, signSsoHandoffToken } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

const HANDOFF_EXPIRES = "24h";

export async function POST(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const parsed = createUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "organization_id and email are required", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;

  try {
    // Idempotency: if a user with this email + org already exists, reuse it.
    let row = await prisma.user.findFirst({
      where: { email: body.email, organizationId: body.organization_id },
      select: { id: true, email: true, organizationId: true },
    });

    if (!row) {
      // FoloUp's user.id is TEXT (Clerk user id when Clerk is wired; for
      // pre-Clerk admin users we generate one prefixed with cognis_ so they're
      // distinguishable from Clerk-minted rows).
      const userId = body.clerk_user_id ?? `cognis_${crypto.randomUUID()}`;
      row = await prisma.user.create({
        data: {
          id: userId,
          email: body.email,
          organizationId: body.organization_id,
        },
        select: { id: true, email: true, organizationId: true },
      });
    }

    const ssoHandoffToken = await signSsoHandoffToken(
      {
        user_id: row.id,
        organization_id: row.organizationId ?? body.organization_id,
      },
      HANDOFF_EXPIRES,
      auth,
    );

    const payload: FoloupUser = {
      id: row.id,
      email: row.email ?? body.email,
      organizationId: row.organizationId,
      ssoHandoffToken,
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.error(`user provision failed: ${message}`);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}
