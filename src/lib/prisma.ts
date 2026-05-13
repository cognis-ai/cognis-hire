// Prisma client singleton.
//
// Next.js dev mode hot-reloads modules. Without a singleton, each reload
// instantiates a new PrismaClient and leaks Postgres connections (the
// upstream Prisma docs flag this — pris.ly/d/help/next-js-best-practices).
// In production each lambda / server instance reuses the module-level binding.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
