// Container/orchestrator health probe.
//
// Returns 200 with metadata when the process can serve traffic; 503 when the
// DB is unreachable so Coolify/Railway/k8s can restart or pull from rotation.
//
// Deliberately public (no auth) — health checks come from infra, not users.
// Doesn't leak anything sensitive: just version + DB reachability.

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // never cache

export async function GET() {
  let dbStatus: "up" | "down" = "down";
  let dbError: string | undefined;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbStatus = "up";
  } catch (err) {
    dbError = err instanceof Error ? err.message : "unknown";
  }

  const body = {
    status: dbStatus === "up" ? "ok" : "degraded",
    commit: process.env.COGNIS_COMMIT_SHA ?? "dev",
    db: dbStatus,
    ...(dbError ? { dbError } : {}),
  };

  return NextResponse.json(body, { status: dbStatus === "up" ? 200 : 503 });
}
