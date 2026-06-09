import { expect, test } from '@playwright/test';

// Brand-integrity checks: the product must present as "Cognis Hire", not the
// upstream name. The ONLY permitted upstream mention is a license-required
// attribution (MIT notice) — the app chrome itself must be clean.
const BRAND = 'Cognis Hire';
const UPSTREAM = /FoloUp/i;

test.describe('Cognis Hire — brand integrity', () => {
  test('sign-in page is branded Cognis Hire with no upstream product name', async ({
    browser,
  }) => {
    // Clean, unauthenticated context.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/sign-in');

    await expect(page).toHaveTitle(new RegExp(BRAND));
    const body = await page.locator('body').innerText();
    expect(body, 'no "FoloUp" anywhere on the sign-in page').not.toMatch(UPSTREAM);
    await ctx.close();
  });

  test('authenticated chrome (title + navbar wordmark) reads Cognis Hire', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(new RegExp(BRAND));
    // Navbar wordmark: "Cognis" + accent-coloured "Hire".
    const wordmark = page.locator('nav, div').filter({ hasText: BRAND }).first();
    await expect(wordmark).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`${BRAND}.*Beta`, 's') })).toBeVisible();
  });

  test('no upstream product name leaks into the dashboard chrome', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My Interviews' })).toBeVisible();
    const body = await page.locator('body').innerText();
    // License attribution (if rendered anywhere) is the only allowed mention;
    // the dashboard chrome has none, so the page must be fully clean.
    const mentions = body.match(UPSTREAM) ?? [];
    expect(mentions.length, 'no "FoloUp" in the authenticated chrome').toBe(0);
  });
});
