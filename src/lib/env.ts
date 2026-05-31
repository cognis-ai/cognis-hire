// Centralized, Zod-validated env loader for the cognis-hire fork.
//
// Why: upstream FoloUp's pattern of `process.env.X ?? undefined` everywhere
// lets a missing var silently coerce to undefined and explode on the first
// downstream call (hours into production, in front of a real customer).
// We fail fast at module load instead.
//
// Called from instrumentation.ts at server boot. Also exported for tests.

import { z } from "zod";

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const requiredString = z.string().min(1);

const EnvSchema = z.object({
  // ---- Database ----
  DATABASE_URL: requiredString.refine((u) => u.startsWith("postgres"), {
    message: "DATABASE_URL must be a postgres connection string",
  }),

  // ---- Clerk (required everywhere — the fork can't render without it) ----
  CLERK_SECRET_KEY: requiredString,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: requiredString,

  // ---- Admin bridge ----
  // Required for any /api/admin/* call and for HMAC-signing SSO handoff JWTs.
  // Not strictly required at boot — the fork can still render the dashboard
  // without it — but production must set it; we warn loudly if absent.
  FOLOUP_ADMIN_SHARED_SECRET: z.string().optional(),

  // ---- LLM gateway (Bridge LiteLLM proxy) ----
  COGNIS_LITELLM_URL: optionalUrl,
  COGNIS_LITELLM_KEY: z.string().optional(),

  // ---- Bridge webhook target (for forwarding interview-complete events) ----
  BRIDGE_PUBLIC_URL: optionalUrl,

  // ---- Voice bot sidecar (Pipecat) ----
  VOICE_BOT_BASE_URL: optionalUrl,
  VOICE_BOT_SHARED_SECRET: z.string().optional(),

  // ---- Misc operational ----
  COGNIS_COMMIT_SHA: z.string().optional(),
  NEXT_PUBLIC_LIVE_URL: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.error("[env] invalid environment:", fieldErrors);
    throw new Error(
      `Environment validation failed: ${JSON.stringify(fieldErrors)}`,
    );
  }
  cached = parsed.data;

  // Soft warnings for prod-required but boot-optional vars.
  if (process.env.NODE_ENV === "production") {
    const warnIfEmpty = (k: keyof Env, why: string) => {
      if (!cached?.[k]) console.warn(`[env] ${k} is unset — ${why}`);
    };
    warnIfEmpty("FOLOUP_ADMIN_SHARED_SECRET", "Bridge admin calls + SSO will 500");
    warnIfEmpty("COGNIS_LITELLM_KEY", "LLM calls will fail at first request");
    warnIfEmpty("BRIDGE_PUBLIC_URL", "interview-complete webhooks won't reach Bridge");
    warnIfEmpty("VOICE_BOT_BASE_URL", "voice interviews will fail to start");
    warnIfEmpty("VOICE_BOT_SHARED_SECRET", "voice webhook signature verification will fail");
  }

  return cached;
}
