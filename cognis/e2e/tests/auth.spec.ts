import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { CLERK_TEST_OTP, E2E_EMAIL } from './helpers';

// These tests exercise the raw auth surface, so start each from a clean,
// unauthenticated context (ignore the shared storageState).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Cognis Hire — authentication', () => {
  test('anonymous visit to a protected page redirects to Clerk sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    // clerkMiddleware protects /dashboard(.*) — anon users land on a sign-in
    // surface (in-app /sign-in or the instance's hosted sign-in page).
    await page.waitForURL(/sign-in/);
    expect(page.url()).toMatch(/sign-in/);
    await expect(page.getByRole('heading', { name: 'My Interviews' })).toHaveCount(0);
  });

  test('happy path: e2e user signs in through the Clerk UI with the test OTP', async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');

    // Clerk <SignIn/> widget: email-code is the instance's only first factor.
    const identifier = page.locator('input[name="identifier"]');
    await expect(identifier).toBeVisible();
    await identifier.fill(E2E_EMAIL);
    await page.getByRole('button', { name: /^continue$/i }).click();

    // The provisioned user also has a password, so Clerk offers the password
    // factor first. Switch to the email-code factor (the instance's canonical
    // first factor) via "Use another method".
    const useAnother = page.getByRole('link', { name: /use another method/i });
    await expect(
      useAnother.or(page.getByText(/check your email/i)).first(),
    ).toBeVisible();
    if (await useAnother.isVisible()) {
      await useAnother.click();
      await page.getByRole('button', { name: /email code to/i }).click();
    }

    // +clerk_test addresses verify with the fixed OTP (Clerk auto-attempts
    // once all digits are entered).
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    const codeInput = page.getByRole('textbox', { name: /enter verification code/i });
    await expect(codeInput).toBeVisible();
    await codeInput.fill(CLERK_TEST_OTP);

    // After switching factors the email-code verification can land
    // unprepared ("You need to send a verification code before attempting
    // to verify") — a Resend prepares it, then re-enter the OTP.
    const needSend = page.getByText(/need to send a verification code/i);
    try {
      await needSend.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /resend/i }).click();
      await codeInput.fill(CLERK_TEST_OTP);
    } catch {
      // Verification was already prepared — nothing to do.
    }

    // forceRedirectUrl="/dashboard" on the SignIn component.
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'My Interviews' })).toBeVisible();
  });

  test('logout via the user menu returns to sign-in and drops the session', async ({ page }) => {
    // Establish a session programmatically (UI login is covered above).
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');
    await clerk.signIn({
      page,
      signInParams: { strategy: 'email_code', identifier: E2E_EMAIL },
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My Interviews' })).toBeVisible();

    // Clerk <UserButton afterSignOutUrl="/sign-in" /> in the navbar.
    await page.getByRole('button', { name: /open user menu/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await page.waitForURL(/sign-in/);

    // The session is really gone: a fresh hit on /dashboard bounces again.
    await page.goto('/dashboard');
    await page.waitForURL(/sign-in/);
  });
});
