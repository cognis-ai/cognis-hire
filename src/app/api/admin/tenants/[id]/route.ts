// DELETE /api/admin/tenants/[id] — soft-delete the tenant by stamping
// organization.deleted_at. We never hard-delete: candidate-facing call URLs
// must remain readable for compliance archive.

import { getAdminSupabase, requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing tenant id" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("organization")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.error(`tenant soft-delete failed: ${error.message}`);
    return NextResponse.json({ error: "soft-delete failed" }, { status: 500 });
  }

  return NextResponse.json({ id, deleted: true }, { status: 200 });
}
