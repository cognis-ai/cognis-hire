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

Phase 4 theming (spec `cognis-platform/docs/design/theming/cognis-hire.md`,
gate2 `cognis-platform/docs/design/gate2/cognis-hire-verification.md`) — all
Cognis-branded, keep per fork-ops upstream-PR table; commit prefix `fork:`:

- `public/browser-client-icon.ico` — binary content swap (§5.1): upstream
  FoloUp favicon replaced by the Cognis "C" mark on `color.brand.primary`
  `#0099ff`. Filename kept ⇒ zero code edits. Rebase resolution: always
  `ours` (`git checkout --ours public/*.ico`). Guarded by the byte-hash test
  in `cognis/e2e/tests/branding.spec.ts`.
- `public/browser-user-icon.ico` — same swap (§5.2), candidate-facing, Cognis
  "C" mark on `color.brand.navy` `#083247`. Same rebase rule + hash guard.
- `tailwind.config.ts` — `theme.extend.colors.indigo` remap (§5.3): the only
  config-layer path to recolor ~84 hardcoded `indigo-*` classes across 27
  upstream files. Every hex carries a `// token: color.brand.*` provenance
  comment (tokens: `cognis-platform/packages/design-tokens/tokens.json`).
  NOTE: 500/600 invert Tailwind's lightness convention (hover darkens) —
  pending visual hover/disabled-state review (gate2 item 14b).
- `.env.example` — upstream-origin file (gate2 item 9 reclassified it
  `isUpstreamFile:true`; it was already diverged +21/−5 by prior `wire:`
  work): appended `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL`,
  `NEXT_PUBLIC_BRAND_MARKETING_URL` + OG-PNG repoint note to the
  Cognis-added brand block. Rebase conflict = union; trivial.

Done in the same change-set (gate2 item 14d): `NEXT_PUBLIC_BRAND_PRIMARY`
default and `public/manifest.json` `theme_color` flipped `#4F46E5` → `#0099ff`
(`color.brand.primary`; manifest JSON cannot carry comments — provenance is
this entry). Cognis-owned files (no ledger impact): `src/lib/cognis-brand.ts`
(env-driven `marketingUrl`), `public/manifest.json` (PWA icons),
`Dockerfile.cognis` (brand build args), `public/brand-assets/*` (asset pack —
regeneration + provenance in `cognis/brand-src/generate_brand_assets.py`;
logo SVGs are the fleet-canonical `CognisAi.` outline copied from
cognis-support), `cognis/e2e/tests/branding.spec.ts` (asset/manifest/hash
gates).

Upstream-file edit count for theming: 3 new (2 binary + 1 config block) + the
`.env.example` append on an already-diverged file. Spec §10's "12 total" is
13 with the `.env.example` reclassification (gate2 verdict condition 1).

## References

- Fork-ops doctrine: `cognis-platform/docs/specs/fork-ops.md`
- LLM proxy contract: `cognis-platform/docs/specs/ai-gateway.md`
- Bridge service: `cognis-platform/docs/specs/bridge-service.md`
