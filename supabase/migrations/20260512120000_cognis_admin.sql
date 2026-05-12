-- Cognis admin schema additions (Phase 2 W8.3).
--
-- Adds the columns + table needed for Bridge → fork tenant provisioning:
--   1. organization.cognis_org_id — idempotency key from Bridge
--   2. organization.deleted_at — soft-delete flag
--   3. interview_template — bulk-seeded role templates per tenant
--
-- Upstream FoloUp's organization.id is TEXT (default uuid_generate_v4()
-- but typed as TEXT). We keep references typed TEXT to match. The Bridge
-- treats Cognis-side org UUIDs as opaque strings, so this round-trips
-- without casting on either side.

BEGIN;

-- 1. organization additions
ALTER TABLE organization
    ADD COLUMN IF NOT EXISTS cognis_org_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS organization_cognis_org_id_key
    ON organization (cognis_org_id)
    WHERE cognis_org_id IS NOT NULL;

ALTER TABLE organization
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. interview_template — seeded by Bridge during onboarding so a new
--    tenant lands with role-specific question packs (engineer / sales / etc).
CREATE TABLE IF NOT EXISTS interview_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    description TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT interview_template_org_role_unique UNIQUE (organization_id, role)
);

CREATE INDEX IF NOT EXISTS interview_template_org_idx
    ON interview_template (organization_id);

COMMIT;
