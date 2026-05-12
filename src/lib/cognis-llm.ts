// Cognis LLM client wrapper.
//
// Routes all OpenAI-style chat completions through Bridge's LiteLLM gateway
// (llm.cognisai.com) instead of calling OpenAI directly. Keeps the
// OpenAI-compatible request/response shape so existing callers don't change.
//
// Server-side only. Do NOT import this from a "use client" component — the
// LiteLLM virtual key must never reach the browser.
//
// TODO(multi-tenant): For v1 (Phase 2 W8.4) we use a single dev-workspace
// virtual key from env. Once W9.1 ships the Clerk-org auth bridge, the key
// should be looked up from the request's Clerk org context so each tenant
// gets its own per-org budget + per-org analytics in Langfuse.

type ChatRole = "system" | "user" | "assistant" | "tool" | "function";

export interface CognisChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface CognisChatRequest {
  model: string;
  messages: CognisChatMessage[];
  response_format?: { type: "json_object" | "text" };
  temperature?: number;
  max_tokens?: number;
}

export interface CognisChatChoice {
  index: number;
  message: { role: ChatRole; content: string | null };
  finish_reason: string | null;
}

export interface CognisChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CognisChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_URL = "https://llm.cognisai.com";

function resolveBaseUrl(): string {
  const raw = process.env.COGNIS_LITELLM_URL ?? DEFAULT_URL;

  return raw.replace(/\/$/, "");
}

function resolveKey(): string {
  const key = process.env.COGNIS_LITELLM_KEY;
  if (!key) {
    throw new Error(
      "COGNIS_LITELLM_KEY is not set — request a Bridge-issued virtual key and add it to .env.local",
    );
  }

  return key;
}

export async function cognisChat(req: CognisChatRequest): Promise<CognisChatResponse> {
  const baseUrl = resolveBaseUrl();
  const key = resolveKey();

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "<no body>");
    throw new Error(`cognisChat ${res.status} ${res.statusText}: ${detail.slice(0, 500)}`);
  }

  return (await res.json()) as CognisChatResponse;
}
