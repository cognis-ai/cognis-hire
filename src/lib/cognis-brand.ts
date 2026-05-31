// Cognis branding constants — env-driven so we can switch brands per
// deployment (e.g. white-label customers) without forking code paths.
//
// Defaults assume the Cognis Hire production brand. Override via
// NEXT_PUBLIC_BRAND_* env vars when deploying. SVG assets land in a
// follow-up `brand:` commit (Phase 2 W8.6); for now the paths point at
// /brand-assets/ stubs that 404 cleanly until design ships.

// `??` only catches null/undefined — but Next.js inlines `NEXT_PUBLIC_*` from
// .env files as literal strings, so an unset key like `NEXT_PUBLIC_BRAND_NAME=`
// becomes the string `""` and silently masks the default. Coerce to undefined.
const envOr = (val: string | undefined, fallback: string): string =>
  val && val.length > 0 ? val : fallback;

export const COGNIS_BRAND = {
  name: envOr(process.env.NEXT_PUBLIC_BRAND_NAME, "Cognis Hire"),
  shortName: envOr(process.env.NEXT_PUBLIC_BRAND_SHORT_NAME, "Cognis"),
  logoUrl: envOr(process.env.NEXT_PUBLIC_BRAND_LOGO_URL, "/brand-assets/cognis-logo.svg"),
  logoDarkUrl: envOr(
    process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL,
    "/brand-assets/cognis-logo-dark.svg",
  ),
  thumbnailUrl: envOr(
    process.env.NEXT_PUBLIC_BRAND_THUMBNAIL_URL,
    "/brand-assets/cognis-thumbnail.svg",
  ),
  // Default brand primary placeholder — replace with the real hex when the
  // design system lands (cognis-landing page is currently the source of truth).
  primaryColor: envOr(process.env.NEXT_PUBLIC_BRAND_PRIMARY, "#4F46E5"),
  marketingUrl: "https://cognisai.com",
  // Customer-facing tagline. Matches Cognis Hire positioning in
  // phase-2-hire.md and public/manifest.json description.
  tagline: envOr(
    process.env.NEXT_PUBLIC_BRAND_TAGLINE,
    "AI worker that screens candidates 24/7 without scheduling calls.",
  ),
  // Contact address surfaced in customer-facing copy (e.g. upgrade modal).
  supportEmail: envOr(process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL, "hello@cognisai.com"),
} as const;

export type CognisBrand = typeof COGNIS_BRAND;
