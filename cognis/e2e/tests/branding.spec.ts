import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

// Brand-integrity checks: the product must present as "Cognis Hire", not the
// upstream name. The ONLY permitted upstream mention is a license-required
// attribution (MIT notice) — the app chrome itself must be clean.
const BRAND = "Cognis Hire";
const UPSTREAM = /FoloUp/i;

// SHA-256 of the upstream FoloUp favicons (vendor commit 2d5b302). The icons
// were replaced with Cognis marks (theming spec §5.1/5.2); a rebase that
// resolves the binary conflict the wrong way would silently restore the
// FoloUp icons, which no text grep can catch — hence byte-hash checks.
const UPSTREAM_ICO_SHA256 = {
  "browser-client-icon.ico": "445faf1fd047e1cd29bc3b6bcad111a45f3c9486972bc0064aed9284824a34c3",
  "browser-user-icon.ico": "b39c0ffbdfaae4780e54e97f2ec11ff7b4c8e6066f08b96e8c1e98aadaddd3ae",
} as const;

test.describe("Cognis Hire — brand integrity", () => {
  test("sign-in page is branded Cognis Hire with no upstream product name", async ({ browser }) => {
    // Clean, unauthenticated context.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/sign-in");

    await expect(page).toHaveTitle(new RegExp(BRAND));
    const body = await page.locator("body").innerText();
    expect(body, 'no "FoloUp" anywhere on the sign-in page').not.toMatch(UPSTREAM);
    await ctx.close();
  });

  test("authenticated chrome (title + navbar wordmark) reads Cognis Hire", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(new RegExp(BRAND));
    // Navbar wordmark: "Cognis" + accent-coloured "Hire".
    const wordmark = page.locator("nav, div").filter({ hasText: BRAND }).first();
    await expect(wordmark).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`${BRAND}.*Beta`, "s") })).toBeVisible();
  });

  test("no upstream product name leaks into the dashboard chrome", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "My Interviews" })).toBeVisible();
    const body = await page.locator("body").innerText();
    // License attribution (if rendered anywhere) is the only allowed mention;
    // the dashboard chrome has none, so the page must be fully clean.
    const mentions = body.match(UPSTREAM) ?? [];
    expect(mentions.length, 'no "FoloUp" in the authenticated chrome').toBe(0);
  });

  test("brand asset pack is served (logo, OG image)", async ({ request }) => {
    for (const path of [
      "/brand-assets/cognis-logo.svg",
      "/brand-assets/cognis-logo-dark.svg",
      "/brand-assets/cognis-og.png",
      "/brand-assets/cognis-icon-192.png",
      "/brand-assets/cognis-icon-512.png",
    ]) {
      const res = await request.get(path);
      expect(res.status(), `${path} responds 200`).toBe(200);
    }
  });

  test("og:image resolves to a live asset", async ({ browser, request }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/sign-in");
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(ogImage, "og:image meta present").toBeTruthy();
    const res = await request.get(ogImage as string);
    expect(res.status(), `og:image ${ogImage} responds 200`).toBe(200);
    await ctx.close();
  });

  test("PWA manifest is branded", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name, "manifest name equals brand").toBe(BRAND);
    expect(JSON.stringify(manifest), "no upstream name in manifest").not.toMatch(UPSTREAM);
  });

  test("favicons are not the upstream FoloUp icons (byte-hash)", async ({ request }) => {
    for (const [name, upstreamHash] of Object.entries(UPSTREAM_ICO_SHA256)) {
      const res = await request.get(`/${name}`);
      expect(res.status(), `${name} responds 200`).toBe(200);
      const hash = createHash("sha256")
        .update(await res.body())
        .digest("hex");
      expect(hash, `${name} must not byte-match the upstream FoloUp icon`).not.toBe(upstreamHash);
    }
  });
});
