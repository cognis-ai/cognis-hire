// Session guard for tenant-scoped API routes.
//
// Upstream FoloUp assumes single-tenant per deployment, so its /api/* routes
// don't auth or org-check anything. Our multi-tenant fork must — without this
// guard a signed-in user in Org A could pass Org B's interview IDs and read
// that org's data. requireOrgSession() is the entry point every per-org API
// route calls; assertOwnedByOrg() is the second gate when an existing
// resource is being read or mutated.
//
// Auth model: pure Clerk session (orgId from `auth()`). Admin routes use
// FOLOUP_ADMIN_SHARED_SECRET via requireAdminAuth() — separate path.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export interface OrgSession {
  userId: string;
  orgId: string;
}

/**
 * Require an authenticated Clerk session with an active org context.
 * Returns the session, or a NextResponse to bail with (401/403).
 *
 * Usage in a route handler:
 *   const session = await requireOrgSession();
 *   if (session instanceof NextResponse) return session;
 *   // session.userId, session.orgId are typed
 */
export async function requireOrgSession(): Promise<OrgSession | NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    // User is signed in but has no active organization selected. Hire is
    // strictly per-org — fail closed so cross-org bugs can't slip in.
    return NextResponse.json(
      { error: "no active organization — set one via OrganizationSwitcher" },
      { status: 403 },
    );
  }

  return { userId, orgId };
}

/**
 * Assert that a fetched resource's organizationId matches the session's orgId.
 * Returns null on success, or a 404 NextResponse on mismatch (404, not 403,
 * to avoid leaking the existence of resources in other orgs).
 */
export function assertOwnedByOrg(
  resourceOrgId: string | null | undefined,
  sessionOrgId: string,
): NextResponse | null {
  if (resourceOrgId !== sessionOrgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return null;
}
