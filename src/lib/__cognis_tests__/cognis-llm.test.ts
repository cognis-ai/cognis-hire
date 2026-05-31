// Cognis glue test: the LiteLLM client wrapper.
//
// Verifies cognisChat() posts to the configured COGNIS_LITELLM_URL and sends
// the Bearer auth header. Hermetic — global fetch is mocked, no network.
import { cognisChat } from "@/lib/cognis-llm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OK_RESPONSE = {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 0,
  model: "gpt-4o",
  choices: [],
};

function mockFetchOk() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => OK_RESPONSE,
    text: async () => JSON.stringify(OK_RESPONSE),
  }));
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("cognisChat", () => {
  beforeEach(() => {
    vi.stubEnv("COGNIS_LITELLM_URL", "https://litellm.example.test");
    vi.stubEnv("COGNIS_LITELLM_KEY", "sk-test-virtual-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("posts to the configured COGNIS_LITELLM_URL with the Bearer auth header", async () => {
    const fetchMock = mockFetchOk();

    await cognisChat({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://litellm.example.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-virtual-key");
    expect(headers["Content-Type"]).toBe("application/json");
    // A timeout signal must be attached (audit hardening).
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws a clear error when COGNIS_LITELLM_KEY is missing", async () => {
    vi.stubEnv("COGNIS_LITELLM_KEY", "");
    mockFetchOk();

    await expect(
      cognisChat({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/COGNIS_LITELLM_KEY/);
  });

  it("surfaces a non-2xx gateway response as an error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({}),
      text: async () => "upstream down",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cognisChat({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/502/);
  });
});
