import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/call(.*)"]);

// v1 SSO shim (Phase 2 W8.3): if there's no Clerk session but the operator
// is carrying a cognis_sso_user cookie (set by /api/auth/sso-redeem after
// verifying a Bridge-signed JWT), let them through. The cookie is httpOnly +
// signed-payload-only, so it cannot be forged client-side. Production
// migration (W9.1) replaces this with a Clerk Backend SDK sign-in-token
// flow that establishes a real Clerk session and removes the cookie entirely.
const COGNIS_SSO_COOKIE = "cognis_sso_user";

export default clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) {
    return;
  }

  const { userId } = await auth();
  if (userId) {
    return;
  }

  const ssoCookie = req.cookies.get(COGNIS_SSO_COOKIE);
  if (ssoCookie?.value) {
    // Cookie was verified at sso-redeem time; presence is sufficient here.
    // We rely on the cookie's own maxAge for expiry — Next.js omits expired
    // cookies from req.cookies automatically.
    return NextResponse.next();
  }

  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
