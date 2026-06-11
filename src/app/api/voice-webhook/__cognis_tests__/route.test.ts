// Cognis glue test: voice-webhook HMAC signature verification.
//
// Verifies the X-Cognis-Voice-Signature constant-time check: a valid HMAC of
// the raw body passes, an invalid/absent one is rejected with 401. Hermetic —
// Prisma is mocked, Bridge forwarding is short-circuited (env unset), no
// network or DB.
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma so importing the route never instantiates PrismaClient / hits a DB.
// vi.mock is hoisted above imports, so the spy must be created via vi.hoisted.
const { responseCreate } = vi.hoisted(() => ({ responseCreate: vi.fn(async () => ({})) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { response: { create: responseCreate } },
}));

// Keep logger quiet but real-ish.
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/voice-webhook/route";
import { logger } from "@/lib/logger";

const SECRET = "voice-bot-shared-secret-under-test";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

function makeRequest(body: string, signature: string | null) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature !== null) {
    headers.set("x-cognis-voice-signature", signature);
  }

  return new Request("https://hire.test/api/voice-webhook", {
    method: "POST",
    headers,
    body,
  }) as unknown as import("next/server").NextRequest;
}

const VALID_PAYLOAD = JSON.stringify({
  event: "interview_completed",
  session_id: "sess-123",
  transcript: [],
  duration_seconds: 42,
  metadata: { interview_id: "int-1" },
});

describe("voice-webhook POST signature verification", () => {
  beforeEach(() => {
    vi.stubEnv("VOICE_BOT_SHARED_SECRET", SECRET);
    // Leave Bridge env unset so forwardToBridge short-circuits (no network).
    vi.stubEnv("BRIDGE_PUBLIC_URL", "");
    vi.stubEnv("FOLOUP_ADMIN_SHARED_SECRET", "");
    responseCreate.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a request with a valid HMAC signature", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, sign(VALID_PAYLOAD)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
    // Valid payload with interview_id => one persist attempt.
    expect(responseCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects a request with an invalid signature", async () => {
    const badSig = sign(VALID_PAYLOAD, "wrong-secret");
    const res = await POST(makeRequest(VALID_PAYLOAD, badSig));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "invalid signature" });
    expect(responseCreate).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature header", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, null));
    expect(res.status).toBe(401);
    expect(responseCreate).not.toHaveBeenCalled();
  });

  it("rejects a valid signature computed over a different body (tamper)", async () => {
    const tampered = VALID_PAYLOAD.replace("sess-123", "sess-999");
    // Signature is for the original body, but we send the tampered body.
    const res = await POST(makeRequest(tampered, sign(VALID_PAYLOAD)));
    expect(res.status).toBe(401);
    expect(responseCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when VOICE_BOT_SHARED_SECRET is not configured", async () => {
    vi.stubEnv("VOICE_BOT_SHARED_SECRET", "");
    const res = await POST(makeRequest(VALID_PAYLOAD, sign(VALID_PAYLOAD)));
    expect(res.status).toBe(500);
  });
});

describe("voice-webhook Bridge forwarding contract", () => {
  const BRIDGE_SECRET = "foloup-admin-shared-secret-under-test";
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VOICE_BOT_SHARED_SECRET", SECRET);
    vi.stubEnv("BRIDGE_PUBLIC_URL", "https://bridge.test/");
    vi.stubEnv("FOLOUP_ADMIN_SHARED_SECRET", BRIDGE_SECRET);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    responseCreate.mockClear();
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts to /hire/webhook (no /v1 prefix) with a sha256= X-Cognis-Signature", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, sign(VALID_PAYLOAD)));
    expect(res.status).toBe(200);

    // Forwarding is fire-and-forget; wait for the mocked fetch to land.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://bridge.test/hire/webhook");

    // Signature must be HMAC-SHA256 of the exact forwarded bytes with the
    // Bridge-side secret, in Bridge's preferred `sha256=<hex>` form.
    const expected = crypto
      .createHmac("sha256", BRIDGE_SECRET)
      .update(init.body as Buffer)
      .digest("hex");
    expect(init.headers["X-Cognis-Signature"]).toBe(`sha256=${expected}`);
    expect((init.body as Buffer).toString("utf8")).toBe(VALID_PAYLOAD);
  });

  it("logs at error level with the status when Bridge rejects the forward", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const res = await POST(makeRequest(VALID_PAYLOAD, sign(VALID_PAYLOAD)));
    expect(res.status).toBe(200); // upstream sidecar still acked

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("401")),
    );
  });
});
