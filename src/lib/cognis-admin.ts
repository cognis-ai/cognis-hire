// Cognis admin route shared helpers.
//
// Bridge (cognis-platform/apps/bridge) calls these routes during tenant
// provisioning. Auth is a bearer-shared-secret model — we trust the secret
// itself, no per-user auth. The same secret is the HMAC key for SSO handoff
// JWTs so Bridge can mint tokens without a round-trip.
//
// Database access is via Prisma (src/lib/prisma.ts) — the previous Supabase
// helper (getAdminSupabase) was removed when we swapped to Postgres+Prisma.
//
// IMPORTANT: this module is server-only. Don't import from "use client".

import { type JWTPayload, SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

const SECRET_ENV = "FOLOUP_ADMIN_SHARED_SECRET";

export function getSharedSecret(): string {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    throw new Error(`${SECRET_ENV} is not set`);
  }

  return secret;
}

/**
 * Reject requests that don't present `Authorization: Bearer <secret>`.
 * Returns the matched secret on success, or a 401 NextResponse on failure.
 */
export function requireAdminAuth(req: Request): NextResponse | string {
  let expected: string;
  try {
    expected = getSharedSecret();
  } catch (_err) {
    return NextResponse.json({ error: "admin auth not configured on server" }, { status: 500 });
  }

  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const presented = header.slice(7).trim();
  if (presented !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return expected;
}

export interface SsoHandoffClaims extends JWTPayload {
  user_id: string;
  organization_id: string;
}

const ISSUER = "cognis-bridge";
const AUDIENCE = "cognis-hire";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Mint a JWT for the SSO handoff. The token is HS256-signed with the same
 * shared secret used for admin auth — Bridge and the fork never need to
 * exchange a separate signing key.
 */
export async function signSsoHandoffToken(
  payload: SsoHandoffClaims,
  expiresIn: string,
  secret?: string,
): Promise<string> {
  const key = secretKey(secret ?? getSharedSecret());

  return new SignJWT({
    user_id: payload.user_id,
    organization_id: payload.organization_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifySsoHandoffToken(
  token: string,
  secret?: string,
): Promise<SsoHandoffClaims> {
  const key = secretKey(secret ?? getSharedSecret());
  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (typeof payload.user_id !== "string" || typeof payload.organization_id !== "string") {
    throw new Error("malformed sso token");
  }

  return payload as SsoHandoffClaims;
}

export function publicBaseUrl(): string {
  return (
    process.env.FOLOUP_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_LIVE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
