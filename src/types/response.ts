import { z } from "zod";

// Retell's `call_analysis` payload (a sub-object of `details`). Upstream
// FoloUp's `CallData.call_analysis` declared every field required, but
// Retell can omit fields mid-call or while the analyser is still running,
// so the schema marks them optional. The Postgres column is `Json?`, hence
// `details` may be null at rest too.
export const CallAnalysisSchema = z
  .object({
    call_summary: z.string().optional(),
    user_sentiment: z.string().optional(),
    agent_sentiment: z.string().optional(),
    agent_task_completion_rating: z.string().optional(),
    agent_task_completion_rating_reason: z.string().optional(),
    call_completion_rating: z.string().optional(),
    call_completion_rating_reason: z.string().optional(),
  })
  .passthrough();
export type CallAnalysis = z.infer<typeof CallAnalysisSchema>;

// Shape of the `response.details` JSON column. The Retell webhook stores
// the full Retell call object here; consumers in this codebase only read
// `transcript` and `call_analysis.*`, so we keep those typed and allow the
// rest through via `.passthrough()`. The column is nullable (`Json?` in
// Prisma), so `CallDetails | null` is the canonical TS type at the
// service/page boundary.
export const CallDetailsSchema = z
  .object({
    transcript: z.string().optional(),
    call_analysis: CallAnalysisSchema.optional(),
  })
  .passthrough();
export type CallDetails = z.infer<typeof CallDetailsSchema>;

// Shape of the `response.analytics` JSON column — written by
// `services/analytics.service.ts` from the LLM's JSON output. Fields can
// be partial when the analyser fails mid-way or the prompt returns a
// truncated object, so everything is optional. Reads in components use
// `?.overallScore` / `?.communication?.score` patterns — the optional
// shape matches those callsites exactly.
export const AnalyticsSchema = z
  .object({
    overallScore: z.number().optional(),
    overallFeedback: z.string().optional(),
    communication: z
      .object({
        score: z.number(),
        feedback: z.string(),
      })
      .optional(),
    generalIntelligence: z.string().optional(),
    softSkillSummary: z.string().optional(),
    questionSummaries: z
      .array(
        z.object({
          question: z.string(),
          summary: z.string(),
        }),
      )
      .optional(),
  })
  .passthrough();
export type Analytics = z.infer<typeof AnalyticsSchema>;

export interface Response {
  id: bigint;
  created_at: Date;
  name: string | null;
  interview_id: string;
  duration: number;
  call_id: string;
  details: CallDetails | null;
  is_analysed: boolean;
  email: string;
  is_ended: boolean;
  is_viewed: boolean;
  analytics: Analytics | null;
  candidate_status: string;
  tab_switch_count: number;
}

export interface FeedbackData {
  interview_id: string;
  satisfaction: number | null;
  feedback: string | null;
  email: string | null;
}

export interface CallData {
  call_id: string;
  agent_id: string;
  audio_websocket_protocol: string;
  audio_encoding: string;
  sample_rate: number;
  call_status: string;
  end_call_after_silence_ms: number;
  from_number: string;
  to_number: string;
  metadata: Record<string, unknown>;
  retell_llm_dynamic_variables: {
    customer_name: string;
  };
  drop_call_if_machine_detected: boolean;
  opt_out_sensitive_data_storage: boolean;
  start_timestamp: number;
  end_timestamp: number;
  transcript: string;
  transcript_object: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  transcript_with_tool_calls: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  recording_url: string;
  public_log_url: string;
  e2e_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_websocket_network_rtt_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  disconnection_reason: string;
  call_analysis: {
    call_summary: string;
    user_sentiment: string;
    agent_sentiment: string;
    agent_task_completion_rating: string;
    agent_task_completion_rating_reason: string;
    call_completion_rating: string;
    call_completion_rating_reason: string;
  };
}
