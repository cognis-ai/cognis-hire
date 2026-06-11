// Shared constants for the Cognis Hire e2e suite.
//
// The test identity is a +clerk_test address in the fork's Clerk instance:
// such addresses auto-verify with the fixed OTP 424242, so no mailbox is
// needed. The user is provisioned (org "Acme 4411154") for the Hire tenant.
export const E2E_EMAIL = process.env.HIRE_E2E_EMAIL ?? "e2e-new-4411154+clerk_test@cognis.io";

export const CLERK_TEST_OTP = "424242";

export const AUTH_FILE = ".auth/user.json";
