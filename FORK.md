# Fork of FoloUp/FoloUp

This repo is a **soft fork** of [`FoloUp/FoloUp`](https://github.com/FoloUp/FoloUp), maintained as `cognis-hire` under the Cognis AI platform. License posture: MIT throughout — upstream is single-license MIT, no enterprise/proprietary directory to strip.

`cognis-hire` is the AI-recruiting product (Phase 2) of the Cognis platform-of-products. See [`cognis-platform`](https://github.com/cognis-ai/cognis-platform) for the shared brain (Bridge, LiteLLM proxy, Clerk auth, billing).

## Branches

| Branch | Purpose |
|---|---|
| `vendor/upstream` | Mirror of `FoloUp/FoloUp:main`. NEVER edit. Rebased by the nightly bot. |
| `cognis/main` | Cognis work. Rebased monthly onto `vendor/upstream`. Default branch. |

## Commit prefixes (grep-friendly across rebases)

- `fork:` — surgical edits to upstream files (last resort; prefer Bridge integration)
- `brand:` — branding (logos, theme, copy)
- `wire:` — Cognis integration plumbing (Clerk-via-Bridge auth, LiteLLM client, Bridge API calls)
- `ci:` — GitHub Actions, license gate, rebase bot
- `docs:` — FORK.md, CLAUDE.md, CODEOWNERS, READMEs

## Bootstrap state

This fork's `cognis/main` is `vendor/upstream` + a single `chore: cognis-hire fork bootstrap` commit dropping in fork templates. No upstream files have been modified. No directories stripped — upstream is single-license MIT.

If a future upstream change introduces a proprietary directory (`/enterprise/`, `/ee/`, `/cloud/`, `/pro/`, `/saas/`, `/platform/`), the license-gate CI will fail; resolve by stripping in a dedicated `chore: strip <dir>` commit on `cognis/main` and adding the path to the rebase bot's modify-delete auto-resolver.

## Fork-diff target

≤0.5% of upstream LOC (slightly looser than Chatwoot's ≤0.1% because Hire has more Cognis-specific surface: Clerk-via-Bridge auth, LiteLLM swap, Cognis branding). Tracked on every PR via `git diff vendor/upstream...cognis/main --stat`. Hard cap 5% — build fails above that.

## Rebase cadence

- Nightly bot: `.github/workflows/upstream-rebase.yml` runs at 06:00 UTC
- Auto-merge clean rebases via Mergify
- Conflicts → bot opens issue labeled `rebase-conflict`; human review
- Shared `rerere-cache` committed to `cognis-platform/infra/rerere-cache/cognis-hire/`

## Upstream-PR policy

Contribute back to `FoloUp/FoloUp` *before* merging to `cognis/main`:
- Bug fixes, perf patches, test improvements, i18n, a11y, refactors that shrink fork diff

Keep in fork (do NOT upstream):
- Clerk / Stripe / LiteLLM / Cognis-branded code
- Cognis-specific multi-tenant primitives, billing meters, audit integration
- Replacement of FoloUp's direct OpenAI/Retell calls with `@cognis/llm-client` → llm.cognisai.com proxy

## Upstream-file edits (justification log)

Gate 1 defect 8 / M9 — server-side plan-quota enforcement (upstream only checks
the free-plan response quota client-side on dashboard load):

- `src/services/responses.service.ts` — `createResponse` now consults
  `src/lib/cognis/quota.ts` (additive Cognis layer) and returns a typed
  `{ error: "QUOTA_EXCEEDED" }` instead of inserting when the org is at its
  limit. Defense-in-depth: the function is a Server Action callable directly
  from the browser. (File was already Cognis-rewritten for Prisma.)
- `src/components/call/index.tsx` — catch block around `/api/start-interview`
  surfaces the typed 403 `QUOTA_EXCEEDED` with a quota-specific toast instead
  of the generic retry message. (File was already Cognis-rewritten for
  Pipecat.)

The primary gate lives in Cognis-added files: `src/lib/cognis/quota.ts` and
`src/app/api/start-interview/route.ts` (403 + `code: "QUOTA_EXCEEDED"` before
any voice-bot session is provisioned). Do NOT upstream — quota semantics are
tied to Cognis billing.

## References

- Fork-ops doctrine: `cognis-platform/docs/specs/fork-ops.md`
- LLM proxy contract: `cognis-platform/docs/specs/ai-gateway.md`
- Bridge service: `cognis-platform/docs/specs/bridge-service.md`
