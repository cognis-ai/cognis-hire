// GET /api/admin/users/[id]/sso-token — mint a short-lived SSO redirect URL.
//
// Mirrors Chatwoot's /platform/api/v1/users/:id/login flow (W5.2): Bridge
// asks the fork for a hand-off URL, returns it to the operator's browser,
// browser hits /api/auth/sso-redeem which sets a cookie and 302s into the
// dashboard.
//
// Token TTL: 5 minutes. Single-use is enforced loosely via the short TTL —
// strict single-use needs a nonce table which lands in W9.1.

import {
  getAdminSupabase,
  publicBaseUrl,
  requireAdminAuth,
  signSsoHandoffToken,
} from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_SECONDS = 5 * 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing user id" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("user")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error(`sso-token user lookup failed: ${error.message}`);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
  const token = await signSsoHandoffToken(
    {
      user_id: data.id,
      organization_id: data.organization_id ?? "",
    },
    `${TOKEN_TTL_SECONDS}s`,
    auth,
  );

  const url = new URL("/api/auth/sso-redeem", publicBaseUrl());
  url.searchParams.set("token", token);
  url.searchParams.set("user_id", data.id);

  return NextResponse.json(
    {
      url: url.toString(),
      token,
      expires_at: expiresAt,
    },
    { status: 200 },
  );
}
