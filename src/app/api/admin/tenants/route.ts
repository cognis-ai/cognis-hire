// POST /api/admin/tenants — Bridge-only tenant provisioning.
//
// Body: { cognis_org_id, name, plan?, allowed_responses_count? }
// Returns the FoloupOrganization shape Bridge expects (see
// cognis-platform/apps/bridge/src/core/http-clients/foloup.client.ts).
//
// Idempotent on cognis_org_id — if a row already exists we return it
// instead of erroring. Bridge re-issues provisioning calls on retry
// so this matters.

import { type FoloupOrganization, createTenantBodySchema } from "@/lib/admin-schemas";
import { requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_PLAN = "free";
const DEFAULT_ALLOWED_RESPONSES = 10;

function toFoloupShape(row: {
  id: string;
  name: string | null;
  plan: string | null;
  allowedResponsesCount: number | null;
}): FoloupOrganization {
  return {
    id: row.id,
    name: row.name ?? "",
    plan: row.plan ?? DEFAULT_PLAN,
    allowedResponsesCount: row.allowedResponsesCount ?? DEFAULT_ALLOWED_RESPONSES,
  };
}

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

  const parsed = createTenantBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "cognis_org_id and name are required", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;

  try {
    // Idempotency: if this cognis_org_id already exists (non-deleted), return it.
    const existing = await prisma.organization.findFirst({
      where: { cognisOrgId: body.cognis_org_id, deletedAt: null },
      select: { id: true, name: true, plan: true, allowedResponsesCount: true },
    });

    if (existing) {
      return NextResponse.json(toFoloupShape(existing), { status: 200 });
    }

    const created = await prisma.organization.create({
      data: {
        id: uuidv4(),
        name: body.name,
        plan: body.plan ?? DEFAULT_PLAN,
        allowedResponsesCount: body.allowed_responses_count ?? DEFAULT_ALLOWED_RESPONSES,
        cognisOrgId: body.cognis_org_id,
      },
      select: { id: true, name: true, plan: true, allowedResponsesCount: true },
    });

    return NextResponse.json(toFoloupShape(created), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.error(`tenant provision failed: ${message}`);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}
