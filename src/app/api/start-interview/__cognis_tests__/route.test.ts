// Cognis glue test: server-side quota gate on /api/start-interview (Gate 1
// defect 8 / M9). An org past its free-plan response limit must be blocked
// with a typed 403 BEFORE any voice-bot session is provisioned. Hermetic —
// Prisma is mocked, fetch is stubbed, no network or DB.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { interviewFindFirst, organizationFindFirst, responseCount } = vi.hoisted(() => ({
  interviewFindFirst: vi.fn(),
  organizationFindFirst: vi.fn(),
  responseCount: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    interview: { findFirst: interviewFindFirst },
    organization: { findFirst: organizationFindFirst },
    response: { count: responseCount },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/start-interview/route";

const INTERVIEW_ROW = {
  id: "int-1",
  isActive: true,
  organizationId: "org-1",
  objective: "screen for the role",
  timeDuration: "15",
};

function makeRequest(body: unknown) {
  return new Request("https://hire.test/api/start-interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const VALID_BODY = { interview_id: "int-1", dynamic_data: { name: "Ada" } };

describe("start-interview POST quota gate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VOICE_BOT_BASE_URL", "https://voice-bot.test");
    vi.stubEnv("VOICE_BOT_SHARED_SECRET", "voice-bot-secret-under-test");
    // Leave Bridge env unset so the session-key mint is skipped (dev mode).
    vi.stubEnv("BRIDGE_PUBLIC_URL", "");
    vi.stubEnv("COGNIS_ADMIN_TOKEN", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    interviewFindFirst.mockReset().mockResolvedValue(INTERVIEW_ROW);
    organizationFindFirst.mockReset();
    responseCount.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a typed 403 and never contacts the voice-bot when the org is over quota", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: 10 });
    responseCount.mockResolvedValue(10);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("QUOTA_EXCEEDED");
    expect(typeof json.error).toBe("string");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a free_trial_over org regardless of count", async () => {
    organizationFindFirst.mockResolvedValue({
      plan: "free_trial_over",
      allowedResponsesCount: 10,
    });
    responseCount.mockResolvedValue(2);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts the session when the org is under quota", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "free", allowedResponsesCount: 10 });
    responseCount.mockResolvedValue(3);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "sess-1", ws_path: "/ws/sess-1", ws_token: "tok" }),
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_id).toBe("sess-1");
    expect(json.ws_url).toBe("wss://voice-bot.test/ws/sess-1?t=tok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://voice-bot.test/start_bot");
  });

  it("starts the session for a pro org without counting responses", async () => {
    organizationFindFirst.mockResolvedValue({ plan: "pro", allowedResponsesCount: 10 });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "sess-2", ws_path: "/ws/sess-2", ws_token: "tok" }),
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(responseCount).not.toHaveBeenCalled();
  });

  it("still 404s an unknown interview before any quota lookup", async () => {
    interviewFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });
});
