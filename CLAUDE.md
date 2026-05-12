# Cognis Hire — repo context for Claude

This is a soft fork of `FoloUp/FoloUp` (AI-recruiting / interview agent). **The fork is not the product — `cognis-platform/apps/bridge` is.** Every hour spent editing Next.js routes here costs 3× at next rebase. Cognis-specific code lives in Bridge; this repo holds branding, auth glue, and the LiteLLM swap.

## Branches

- `cognis/main` — default. Cognis work.
- `vendor/upstream` — mirror of FoloUp:main. NEVER edit.

## Hard rules

1. **Never `import openai` / `import retell` / `import anthropic` directly.** Route everything through `@cognis/llm-client` (TS) → `llm.cognisai.com` proxy. FoloUp's stock OpenAI and Retell calls must be wrapped, not used raw.
2. **Never edit upstream Next.js files casually.** Prefer wrapping (HOCs, middleware, environment-variable swaps) over surgical edits. If you must touch an upstream file, the PR upstream is mandatory before merging to `cognis/main`.
3. **Fork-diff cap: 5% of upstream LOC.** Tracked per-PR. Target ≤0.5%.
4. **Commit prefixes only:** `fork:` / `brand:` / `wire:` / `ci:` / `docs:`.
5. **All Cognis-specific code that isn't pure branding goes in Bridge.** This repo holds: branding overlay, Clerk-via-Bridge auth shim, LiteLLM client wrapper, FORK.md/CLAUDE.md/CODEOWNERS.
6. **License posture is single-MIT.** Do not introduce dependencies under AGPL, SSPL, BUSL, FSL, PolyForm, Commons Clause, or Elastic License. License-gate CI will catch this on PR.

## Stack (upstream)

- Next.js 16 (App Router) on `--webpack` (note: NOT Turbopack)
- React 18 + TypeScript 5
- Tailwind + shadcn/ui + Radix + MUI (mixed — upstream legacy)
- Supabase (`@supabase/supabase-js`) for data; Prisma 5 for typed access
- Clerk (`@clerk/nextjs`) for auth (upstream already uses Clerk — saves us a swap)
- Retell SDK for voice interviews
- OpenAI SDK for prompt/scoring logic
- Biome for lint/format (NOT ESLint, NOT Prettier)
- Yarn lockfile upstream

## Cognis-specific surface (to be built in Phase 2)

- `src/lib/cognis/llm-client.ts` — thin wrapper over `@cognis/llm-client-ts` so FoloUp's `openai.chat.completions.create()` calls become Cognis-proxied
- `src/lib/cognis/bridge-client.ts` — Bridge org-resolution + billing-event emission
- `src/middleware.ts` overlay — Clerk JWT validation calls Bridge for tenant resolution
- Branding: `public/cognis-*` assets, env-driven theme overlay
- `.github/workflows/license-gate.yml` — ScanCode CI gate (blocks proprietary licenses sneaking in via deps)
- `.github/workflows/upstream-rebase.yml` — nightly rebase bot
- `tools/check_no_proprietary.py` — license allowlist enforcement

## Build & test

This is upstream FoloUp: `yarn install`, `yarn dev`, etc. See upstream README. (Don't run inside the fork until Phase 2 — bootstrap stage is git topology only.)

## What NOT to do

- Don't `import openai` or `import @anthropic-ai/sdk` directly — use the Cognis LLM client wrapper
- Don't add NestJS / Bridge logic here — that's in `cognis-platform/apps/bridge`
- Don't touch `vendor/upstream` directly — it's a mirror branch
- Don't commit credentials; `.env.local` is gitignored upstream
- Don't switch off Biome or Yarn — keep upstream's tooling to minimize rebase friction
- Don't move to Turbopack — upstream pinned `--webpack` for a reason (Next 16 RC compat)
