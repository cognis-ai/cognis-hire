// Zod schemas for the /api/admin/* HTTP boundary.
//
// Bridge → fork traffic crosses an HTTP boundary, so we parse both the
// inbound request bodies AND the outbound response shapes with Zod. This
// preserves the Bridge-side contract documented in
// cognis-platform/apps/bridge/src/core/http-clients/foloup.client.ts even
// after the underlying data layer flipped from Supabase to Prisma.
//
// Internal-only Prisma queries don't go through Zod — Prisma already gives
// us typed objects. The line: data IN/OUT of HTTP → Zod; internal flow → Prisma types.

import { z } from "zod";

/** POST /api/admin/tenants — request body Bridge sends. */
export const createTenantBodySchema = z.object({
  cognis_org_id: z.string().min(1),
  name: z.string().min(1),
  plan: z.enum(["free", "pro", "free_trial_over"]).optional(),
  allowed_responses_count: z.number().int().nonnegative().optional(),
});
export type CreateTenantBody = z.infer<typeof createTenantBodySchema>;

/** POST /api/admin/tenants — response shape Bridge expects (FoloupOrganization). */
export const foloupOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  plan: z.string(),
  allowedResponsesCount: z.number().int(),
});
export type FoloupOrganization = z.infer<typeof foloupOrganizationSchema>;

/** POST /api/admin/users — request body. */
export const createUserBodySchema = z.object({
  cognis_org_id: z.string().optional(),
  organization_id: z.string().min(1),
  email: z.string().email(),
  clerk_user_id: z.string().optional(),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

/** POST /api/admin/users — response shape. */
export const foloupUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  organizationId: z.string().nullable(),
  ssoHandoffToken: z.string(),
});
export type FoloupUser = z.infer<typeof foloupUserSchema>;

/** GET /api/admin/users/:id/sso-token — response shape. */
export const ssoTokenResponseSchema = z.object({
  url: z.string().url(),
  token: z.string(),
  expires_at: z.string(),
});
export type SsoTokenResponse = z.infer<typeof ssoTokenResponseSchema>;

/** POST /api/admin/interview-templates — request body. */
export const interviewTemplateItemSchema = z.object({
  role: z.string().min(1),
  description: z.string().nullable().optional(),
  questions: z.array(z.unknown()).optional(),
});
export type InterviewTemplateItem = z.infer<typeof interviewTemplateItemSchema>;

export const bulkInterviewTemplatesBodySchema = z.object({
  organization_id: z.string().min(1),
  templates: z.array(interviewTemplateItemSchema),
});
export type BulkInterviewTemplatesBody = z.infer<typeof bulkInterviewTemplatesBodySchema>;

export const bulkInterviewTemplatesResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
});
export type BulkInterviewTemplatesResponse = z.infer<typeof bulkInterviewTemplatesResponseSchema>;
