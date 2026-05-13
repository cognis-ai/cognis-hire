"use server";

// Client / organization data-access (Prisma).
//
// Functions are exported as Server Actions so that "use client" contexts and
// components can call them directly — Next.js handles the RPC transport.
// Server-side callers (API routes, other server actions) import them like
// normal async functions and skip the RPC roundtrip.

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Legacy callsites pass arbitrary partial-update payloads with snake_case keys
// (e.g., `{ plan: "free_trial_over" }`). Accept that shape and translate to
// Prisma's typed update input below. We deliberately avoid `any` per the
// project directive; `Prisma.OrganizationUncheckedUpdateInput` is the typed
// destination.
type LegacyOrganizationPayload = Record<string, unknown>;

function toPrismaOrganizationUpdate(
  payload: LegacyOrganizationPayload,
): Prisma.OrganizationUncheckedUpdateInput {
  const {
    name,
    image_url,
    imageUrl,
    allowed_responses_count,
    allowedResponsesCount,
    plan,
    cognis_org_id,
    cognisOrgId,
    deleted_at,
    deletedAt,
    ...rest
  } = payload;

  return {
    ...(rest as Prisma.OrganizationUncheckedUpdateInput),
    ...(name !== undefined ? { name: name as string | null } : {}),
    ...(imageUrl !== undefined || image_url !== undefined
      ? { imageUrl: (imageUrl ?? image_url) as string | null }
      : {}),
    ...(allowedResponsesCount !== undefined || allowed_responses_count !== undefined
      ? {
          allowedResponsesCount: (allowedResponsesCount ?? allowed_responses_count) as
            | number
            | null,
        }
      : {}),
    ...(plan !== undefined
      ? { plan: plan as Prisma.OrganizationUncheckedUpdateInput["plan"] }
      : {}),
    ...(cognisOrgId !== undefined || cognis_org_id !== undefined
      ? { cognisOrgId: (cognisOrgId ?? cognis_org_id) as string | null }
      : {}),
    ...(deletedAt !== undefined || deleted_at !== undefined
      ? { deletedAt: (deletedAt ?? deleted_at) as Date | string | null }
      : {}),
  };
}

export async function updateOrganization(payload: LegacyOrganizationPayload, id: string) {
  try {
    return await prisma.organization.update({
      where: { id },
      data: toPrismaOrganizationUpdate(payload),
    });
  } catch (error) {
    logger.error(`updateOrganization failed: ${(error as Error).message}`);

    return [];
  }
}

export async function getClientById(
  id: string,
  email?: string | null,
  organization_id?: string | null,
) {
  try {
    const existing = await prisma.user.findFirst({ where: { id } });

    // No row yet → create one if we have an email (mirrors the legacy upsert).
    if (!existing && email) {
      try {
        return await prisma.user.create({
          data: {
            id,
            email,
            organizationId: organization_id ?? null,
          },
        });
      } catch (error) {
        logger.error(`getClientById create failed: ${(error as Error).message}`);

        return [];
      }
    }

    if (!existing) {
      return null;
    }

    // Row exists but the org changed → patch it.
    if (organization_id !== undefined && existing.organizationId !== organization_id) {
      try {
        return await prisma.user.update({
          where: { id },
          data: { organizationId: organization_id ?? null },
        });
      } catch (error) {
        logger.error(`getClientById update failed: ${(error as Error).message}`);

        return [];
      }
    }

    return existing;
  } catch (error) {
    logger.error(`getClientById failed: ${(error as Error).message}`);

    return [];
  }
}

export async function getOrganizationById(organization_id?: string, organization_name?: string) {
  try {
    if (!organization_id) {
      return null;
    }

    const existing = await prisma.organization.findFirst({ where: { id: organization_id } });

    if (!existing) {
      try {
        return await prisma.organization.create({
          data: {
            id: organization_id,
            name: organization_name ?? null,
          },
        });
      } catch (error) {
        logger.error(`getOrganizationById create failed: ${(error as Error).message}`);

        return [];
      }
    }

    if (organization_name && existing.name !== organization_name) {
      try {
        return await prisma.organization.update({
          where: { id: organization_id },
          data: { name: organization_name },
        });
      } catch (error) {
        logger.error(`getOrganizationById update failed: ${(error as Error).message}`);

        return [];
      }
    }

    return existing;
  } catch (error) {
    logger.error(`getOrganizationById failed: ${(error as Error).message}`);

    return [];
  }
}
