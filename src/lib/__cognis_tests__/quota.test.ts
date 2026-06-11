// Cognis glue test: server-side org response-quota enforcement (Gate 1
// defect 8 / M9). Hermetic — Prisma is mocked, no network or DB. Semantics
// under test mirror the dashboard's client-side check: free plan blocked at
// allowedResponsesCount (default 10), free_trial_over always blocked,
// pro/unset plans unlimited, and fail-OPEN on DB errors.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { organizationFindFirst, responseCount, interviewFindFirst } = vi.hoisted(() => ({
  organizationFindFirst: vi.fn(),
  responseCount: vi.fn(),
  interviewFindFirst: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findFirst: organizationFindFirst },
    response: { count: responseCount },
    interview: { findFirst: interviewFindFirst },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  QUOTA_EXCEEDED,
  checkInterviewResponseQuota,
  checkOrgResponseQuota,
} from "@/lib/cognis/quota";
import { logger } from "@/lib/logger";

describe("checkOrgResponseQuota", () => {
  beforeEach(() => {
    organizationFindFirst.mockReset();
    responseCount.mockReset();
    interviewFindFirst.mockReset();
    vi.mocked(logger.error).mockClear();
  });

  it("allows a free org under its limit", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: 10 });
    responseCount.mockResolvedValue(9);

    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });
    expect(responseCount).toHaveBeenCalledWith({
      where: { interview: { organizationId: "org-1" } },
    });
  });

  it("blocks a free org at its limit with a typed decision", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: 10 });
    responseCount.mockResolvedValue(10);

    expect(await checkOrgResponseQuota("org-1")).toEqual({
      allowed: false,
      code: QUOTA_EXCEEDED,
      plan: "free",
      responsesCount: 10,
      allowedResponsesCount: 10,
    });
  });

  it("defaults the free-plan limit to 10 when allowedResponsesCount is null", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: null });

    responseCount.mockResolvedValue(9);
    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });

    responseCount.mockResolvedValue(10);
    const blocked = await checkOrgResponseQuota("org-1");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.allowedResponsesCount).toBe(10);
    }
  });

  it("always blocks a free_trial_over org, even below the limit", async () => {
    organizationFindFirst.mockResolvedValue({
      plan: "free_trial_over",
      allowedResponsesCount: 10,
    });
    responseCount.mockResolvedValue(3);

    const decision = await checkOrgResponseQuota("org-1");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(QUOTA_EXCEEDED);
      expect(decision.plan).toBe("free_trial_over");
    }
  });

  it("allows a pro org without counting responses", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "pro", allowedResponsesCount: 10 });

    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });
    expect(responseCount).not.toHaveBeenCalled();
  });

  it("allows when the plan is unset (dashboard parity)", async () => {
    organizationFindFirst.mockResolvedValue({ plan: null, allowedResponsesCount: 10 });

    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });
    expect(responseCount).not.toHaveBeenCalled();
  });

  it("allows when the org row does not exist", async () => {
    organizationFindFirst.mockResolvedValue(null);

    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });
  });

  it("allows when organizationId is missing (legacy rows)", async () => {
    expect(await checkOrgResponseQuota(null)).toEqual({ allowed: true });
    expect(await checkOrgResponseQuota(undefined)).toEqual({ allowed: true });
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it("fails OPEN (allows) and logs on a DB error", async () => {
    organizationFindFirst.mockRejectedValue(new Error("db unreachable"));

    expect(await checkOrgResponseQuota("org-1")).toEqual({ allowed: true });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("db unreachable"));
  });
});

describe("checkInterviewResponseQuota", () => {
  beforeEach(() => {
    organizationFindFirst.mockReset();
    responseCount.mockReset();
    interviewFindFirst.mockReset();
  });

  it("resolves the interview's org and delegates to the org check", async () => {
    interviewFindFirst.mockResolvedValue({ organizationId: "org-1" });
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: 5 });
    responseCount.mockResolvedValue(5);

    const decision = await checkInterviewResponseQuota("int-1");
    expect(decision.allowed).toBe(false);
    expect(interviewFindFirst).toHaveBeenCalledWith({
      where: { id: "int-1" },
      select: { organizationId: true },
    });
  });

  it("allows when the interview does not exist or has no org binding", async () => {
    interviewFindFirst.mockResolvedValue(null);
    expect(await checkInterviewResponseQuota("int-404")).toEqual({ allowed: true });

    interviewFindFirst.mockResolvedValue({ organizationId: null });
    expect(await checkInterviewResponseQuota("int-1")).toEqual({ allowed: true });
  });

  it("allows when interviewId is missing", async () => {
    expect(await checkInterviewResponseQuota(null)).toEqual({ allowed: true });
    expect(interviewFindFirst).not.toHaveBeenCalled();
  });
});
