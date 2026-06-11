import { expect, test } from "@playwright/test";

// Authenticated core flow against the LIVE fork (storageState from
// auth.setup.ts). The chosen real flow: the dashboard's interview list
// renders for the provisioned tenant and the operator can open the
// "Create an Interview" modal and reach the real creation form.
test.describe("Cognis Hire — dashboard & interview flow", () => {
  test("dashboard loads for an authenticated operator", async ({ page }) => {
    const res = await page.goto("/dashboard");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "My Interviews" })).toBeVisible();
    // Side menu exposes the two core sections.
    await expect(page.getByText("Interviews", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Interviewers", { exact: true }).first()).toBeVisible();
  });

  test("interview list region renders (cards or empty state) without errors", async ({ page }) => {
    await page.goto("/dashboard");
    // The create card (h3) is always the first tile when the plan allows it;
    // its presence proves the interviews fetch resolved (loaders are gone).
    // NB: the creation modal's h1 shares the text but stays hidden in the DOM,
    // so target the card heading level explicitly.
    await expect(
      page.getByRole("heading", { name: "Create an Interview", level: 3 }),
    ).toBeVisible();
    // No client-side crash overlay.
    await expect(page.locator("text=Application error")).toHaveCount(0);
  });

  test("operator can open the interview creation flow and reach the form", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: "Create an Interview", level: 3 }).click();

    // CreateInterviewModal → DetailsPopup renders the real creation form (h1).
    await expect(
      page.getByRole("heading", { name: "Create an Interview", level: 1 }),
    ).toBeVisible();
    const nameInput = page.getByPlaceholder(/name of the interview/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill("E2E smoke interview");
    await expect(page.getByPlaceholder(/find best candidates/i)).toBeVisible();
    // Creation end-to-end needs a voice interviewer (none provisioned in this
    // environment), so the flow stops at the validated form.
  });

  test("interviewers page is reachable from the side menu", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("Interviewers", { exact: true }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/interviewers/);
  });
});
