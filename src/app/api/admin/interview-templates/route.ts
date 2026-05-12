// POST /api/admin/interview-templates — bulk-seed role templates.
//
// Body: { organization_id, templates: [{ role, description, questions: [...] }] }
// Returns { created, failures } counts. Idempotent on (organization_id, role)
// via the unique constraint added in the cognis_admin migration — re-runs
// upsert the existing row instead of erroring.

import { getAdminSupabase, requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

interface TemplateItem {
  role?: string;
  description?: string;
  questions?: unknown[];
}

interface BulkBody {
  organization_id?: string;
  templates?: TemplateItem[];
}

export async function POST(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.organization_id || !Array.isArray(body.templates)) {
    return NextResponse.json(
      { error: "organization_id and templates[] are required" },
      { status: 400 },
    );
  }

  const supabase = getAdminSupabase();
  let created = 0;
  let failures = 0;

  for (const t of body.templates) {
    if (!t.role) {
      failures += 1;
      continue;
    }

    const { error } = await supabase.from("interview_template").upsert(
      {
        organization_id: body.organization_id,
        role: t.role,
        description: t.description ?? null,
        questions: t.questions ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,role" },
    );

    if (error) {
      logger.error(`template upsert failed for role=${t.role}: ${error.message}`);
      failures += 1;
    } else {
      created += 1;
    }
  }

  return NextResponse.json({ created, failures }, { status: 200 });
}
