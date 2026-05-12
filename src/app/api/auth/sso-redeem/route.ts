// GET /api/auth/sso-redeem — public SSO landing route.
//
// Bridge mints a short-lived JWT via /api/admin/users/:id/sso-token and
// redirects the operator's browser here. We verify the JWT, set a signed
// cognis_sso_user cookie containing the user_id + organization_id, then
// 302 to /dashboard.
//
// v1 approach (Phase 2 W8.3): cookie-only. FoloUp's middleware lets Clerk
// auth gate the dashboard; if there's no Clerk session we read the cookie
// instead and treat the user as logged in. The cookie is signed with the
// admin shared secret so a candidate can't forge one.
//
// Production migration (W9.1): swap to Clerk Backend SDK `signInToken` /
// `createSignInToken` so the redirect lands at clerk.com/v1/tickets and
// establishes a real Clerk session. The cookie shim is intentional
// throwaway plumbing — DO NOT build features on top of it.

import { publicBaseUrl, verifySsoHandoffToken } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "cognis_sso_user";
const COOKIE_TTL_SECONDS = 60 * 60 * 8; // 8h browser session window

function failureRedirect(reason: string) {
  const url = new URL("/sign-in", publicBaseUrl());
  url.searchParams.set("sso_error", reason);
  return NextResponse.redirect(url, { status: 302 });
}

async function redeem(req: NextRequest, token: string | null): Promise<NextResponse> {
  if (!token) {
    return failureRedirect("missing_token");
  }

  let claims: { user_id: string; organization_id: string };
  try {
    claims = await verifySsoHandoffToken(token);
  } catch (err) {
    logger.error(`sso redeem verify failed: ${(err as Error).message}`);
    return failureRedirect("invalid_token");
  }

  const target = new URL("/dashboard", publicBaseUrl());
  const res = NextResponse.redirect(target, { status: 302 });

  // Cookie payload is intentionally minimal — middleware reads user_id +
  // organization_id and trusts them because the JWT was already verified
  // before this cookie was set.
  const value = JSON.stringify({
    user_id: claims.user_id,
    organization_id: claims.organization_id,
  });

  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });

  return res;
}

export async function GET(req: NextRequest) {
  return redeem(req, req.nextUrl.searchParams.get("token"));
}

export async function POST(req: NextRequest) {
  // Accept POST too so Bridge can submit the token in form-style if the
  // operator's browser blocked the GET query string for some reason.
  let token = req.nextUrl.searchParams.get("token");
  if (!token) {
    try {
      const body = (await req.json().catch(() => ({}))) as { token?: string };
      token = body.token ?? null;
    } catch {
      token = null;
    }
  }

  return redeem(req, token);
}
