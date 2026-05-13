// POST /api/admin/interview-templates — bulk-seed role templates.
//
// Body: { organization_id, templates: [{ role, description, questions: [...] }] }
// Returns { created, failures } counts. Idempotent on (organization_id, role)
// via the unique constraint on the interview_template table — re-runs upsert
// the existing row instead of erroring.

import {
  type BulkInterviewTemplatesResponse,
  bulkInterviewTemplatesBodySchema,
} from "@/lib/admin-schemas";
import { requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

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

  const parsed = bulkInterviewTemplatesBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "organization_id and templates[] are required",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const body = parsed.data;
  let created = 0;
  let failures = 0;

  for (const t of body.templates) {
    try {
      await prisma.interviewTemplate.upsert({
        where: {
          organizationId_role: {
            organizationId: body.organization_id,
            role: t.role,
          },
        },
        create: {
          organizationId: body.organization_id,
          role: t.role,
          description: t.description ?? null,
          // Prisma's Json input rejects `undefined`; default to an empty array.
          questions: (t.questions ?? []) as object,
        },
        update: {
          description: t.description ?? null,
          questions: (t.questions ?? []) as object,
          updatedAt: new Date(),
        },
      });
      created += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      logger.error(`template upsert failed for role=${t.role}: ${message}`);
      failures += 1;
    }
  }

  const payload: BulkInterviewTemplatesResponse = { created, failures };
  return NextResponse.json(payload, { status: 200 });
}
