// GET /api/admin/interviews?organization_id=... — Bridge-read interview +
// candidate list for the embedded Cognis Hire console.
//
// Mirrors the read-side of the Support inbox (Chatwoot) and Voice console
// (Dograh) integrations: Bridge holds the admin shared secret and proxies a
// single org-scoped read; the operator's browser never touches FoloUp.
//
// Tenant isolation (api/AGENTS.md discipline): the interview list is filtered
// by `organization_id` AT THE QUERY LEVEL — never trust an id from elsewhere,
// and never filter in JS after a broad fetch.

import { requireAdminAuth } from "@/lib/cognis-admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const organizationId = req.nextUrl.searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json({ error: "organization_id is required" }, { status: 400 });
  }

  try {
    const interviews = await prisma.interview.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        objective: true,
        isActive: true,
        createdAt: true,
        questionCount: true,
        responseCount: true,
        readableSlug: true,
        responses: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            name: true,
            email: true,
            candidateStatus: true,
            duration: true,
            isAnalysed: true,
            isEnded: true,
            createdAt: true,
          },
        },
      },
    });

    const payload = interviews.map((iv) => ({
      id: iv.id,
      name: iv.name ?? "Untitled role",
      objective: iv.objective ?? null,
      isActive: iv.isActive,
      createdAt: iv.createdAt.toISOString(),
      questionCount: iv.questionCount ?? null,
      responseCount: iv.responseCount ?? iv.responses.length,
      readableSlug: iv.readableSlug ?? null,
      candidates: iv.responses.map((r) => ({
        id: r.id,
        name: r.name ?? null,
        email: r.email ?? null,
        status: r.candidateStatus ?? null,
        durationSec: r.duration ?? null,
        analysed: r.isAnalysed ?? false,
        completed: r.isEnded ?? false,
        createdAt: r.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({ interviews: payload }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.error(`admin interview list failed: ${message}`);
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }
}
