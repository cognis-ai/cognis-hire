// POST /api/admin/tenants — Bridge-only tenant provisioning.
//
// Body: { cognis_org_id, name, plan?, allowed_responses_count? }
// Returns the FoloupOrganization shape Bridge expects (see
// cognis-platform/apps/bridge/src/core/http-clients/foloup.client.ts).
//
// Idempotent on cognis_org_id — if a row already exists we return it
// instead of erroring. Bridge re-issues provisioning calls on retry
// so this matters.

import { getAdminSupabase, requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

interface CreateTenantBody {
  cognis_org_id?: string;
  name?: string;
  plan?: "free" | "pro" | "free_trial_over";
  allowed_responses_count?: number;
}

const DEFAULT_PLAN = "free";
const DEFAULT_ALLOWED_RESPONSES = 10;

function toFoloupShape(row: {
  id: string;
  name: string | null;
  plan: string | null;
  allowed_responses_count: number | null;
}) {
  return {
    id: row.id,
    name: row.name ?? "",
    plan: row.plan ?? DEFAULT_PLAN,
    allowedResponsesCount: row.allowed_responses_count ?? DEFAULT_ALLOWED_RESPONSES,
  };
}

export async function POST(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: CreateTenantBody;
  try {
    body = (await req.json()) as CreateTenantBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.cognis_org_id || !body.name) {
    return NextResponse.json({ error: "cognis_org_id and name are required" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  // Idempotency: if this cognis_org_id already exists, return it.
  const existing = await supabase
    .from("organization")
    .select("id, name, plan, allowed_responses_count, deleted_at")
    .eq("cognis_org_id", body.cognis_org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) {
    logger.error(`tenant lookup failed: ${existing.error.message}`);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  if (existing.data) {
    return NextResponse.json(toFoloupShape(existing.data), { status: 200 });
  }

  const id = uuidv4();
  const insert = await supabase
    .from("organization")
    .insert({
      id,
      name: body.name,
      plan: body.plan ?? DEFAULT_PLAN,
      allowed_responses_count: body.allowed_responses_count ?? DEFAULT_ALLOWED_RESPONSES,
      cognis_org_id: body.cognis_org_id,
    })
    .select("id, name, plan, allowed_responses_count")
    .single();

  if (insert.error || !insert.data) {
    logger.error(`tenant insert failed: ${insert.error?.message}`);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json(toFoloupShape(insert.data), { status: 201 });
}
