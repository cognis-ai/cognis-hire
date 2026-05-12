// POST /api/admin/users — Bridge-issued admin user creation.
//
// Body: { cognis_org_id, organization_id, email, clerk_user_id? }
// Returns { id, email, organizationId, ssoHandoffToken } shaped for
// FoloupClient.createAdminUser. The ssoHandoffToken is HS256-signed with
// FOLOUP_ADMIN_SHARED_SECRET; Bridge holds it until the operator clicks
// "Open Hire" in the portal, at which point it hits /api/auth/sso-redeem.

import { getAdminSupabase, requireAdminAuth, signSsoHandoffToken } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

interface CreateUserBody {
  cognis_org_id?: string;
  organization_id?: string;
  email?: string;
  clerk_user_id?: string;
}

const HANDOFF_EXPIRES = "24h";

export async function POST(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: CreateUserBody;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.organization_id || !body.email) {
    return NextResponse.json({ error: "organization_id and email are required" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  // FoloUp's user.id is TEXT (Clerk user id when Clerk is wired; for
  // pre-Clerk admin users we generate one prefixed with cognis_ so they're
  // distinguishable from Clerk-minted rows).
  const userId = body.clerk_user_id ?? `cognis_${crypto.randomUUID()}`;

  // Idempotency: if a user with this email + org already exists, reuse it.
  const existing = await supabase
    .from("user")
    .select("id, email, organization_id")
    .eq("email", body.email)
    .eq("organization_id", body.organization_id)
    .maybeSingle();

  if (existing.error) {
    logger.error(`user lookup failed: ${existing.error.message}`);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  let row = existing.data;

  if (!row) {
    const insert = await supabase
      .from("user")
      .insert({
        id: userId,
        email: body.email,
        organization_id: body.organization_id,
      })
      .select("id, email, organization_id")
      .single();

    if (insert.error || !insert.data) {
      logger.error(`user insert failed: ${insert.error?.message}`);
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }

    row = insert.data;
  }

  const ssoHandoffToken = await signSsoHandoffToken(
    {
      user_id: row.id,
      organization_id: row.organization_id ?? body.organization_id,
    },
    HANDOFF_EXPIRES,
    auth,
  );

  return NextResponse.json(
    {
      id: row.id,
      email: row.email,
      organizationId: row.organization_id,
      ssoHandoffToken,
    },
    { status: 201 },
  );
}
