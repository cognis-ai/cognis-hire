// Cognis branding constants — env-driven so we can switch brands per
// deployment (e.g. white-label customers) without forking code paths.
//
// Defaults assume the Cognis Hire production brand. Override via
// NEXT_PUBLIC_BRAND_* env vars when deploying. SVG assets land in a
// follow-up `brand:` commit (Phase 2 W8.6); for now the paths point at
// /brand-assets/ stubs that 404 cleanly until design ships.

export const COGNIS_BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Cognis Hire",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME ?? "Cognis",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "/brand-assets/cognis-logo.svg",
  logoDarkUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL ?? "/brand-assets/cognis-logo-dark.svg",
  thumbnailUrl: process.env.NEXT_PUBLIC_BRAND_THUMBNAIL_URL ?? "/brand-assets/cognis-thumbnail.svg",
  // Default brand primary placeholder — replace with the real hex when the
  // design system lands (cognis-landing page is currently the source of truth).
  primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY ?? "#4F46E5",
  marketingUrl: "https://cognisai.com",
  tagline: "AI-powered Interviews",
} as const;

export type CognisBrand = typeof COGNIS_BRAND;
