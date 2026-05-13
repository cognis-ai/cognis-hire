// DELETE /api/admin/tenants/[id] — soft-delete the tenant by stamping
// organization.deletedAt. We never hard-delete: candidate-facing call URLs
// must remain readable for compliance archive.

import { requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
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

  try {
    await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ id, deleted: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.error(`tenant soft-delete failed: ${message}`);
    return NextResponse.json({ error: "soft-delete failed" }, { status: 500 });
  }
}
