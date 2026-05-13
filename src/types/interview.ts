import { z } from "zod";

// Single interview question authored by the user when creating an
// interview. Stored as part of the `interview.questions` JSON column.
export const QuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  follow_up_count: z.number(),
});
export type Question = z.infer<typeof QuestionSchema>;

// The `interview.questions` JSON column is shaped as `Question[]` in
// practice — the schema gives us runtime validation at boundaries
// (Prisma -> consumer) without affecting the legacy `Question` import.
export const QuestionsSchema = z.array(QuestionSchema);
export type Questions = z.infer<typeof QuestionsSchema>;

// Each element of the `interview.quotes` JSONB[] column.
export const QuoteSchema = z.object({
  quote: z.string(),
  call_id: z.string(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export interface InterviewBase {
  user_id: string;
  organization_id: string;
  name: string;
  interviewer_id: bigint;
  objective: string;
  question_count: number;
  time_duration: string;
  is_anonymous: boolean;
  questions: Question[];
  description: string;
  response_count: bigint;
}

export interface InterviewDetails {
  id: string;
  created_at: Date;
  url: string | null;
  insights: string[];
  quotes: Quote[];
  // Vestigial column — upstream FoloUp never produced or consumed it, and
  // there is no `details` field on the Prisma `Interview` model. Kept on
  // the interface so legacy construction sites that spread DB rows still
  // typecheck; typed as `unknown` so any new consumer is forced to narrow.
  details: unknown;
  is_active: boolean;
  theme_color: string;
  logo_url: string;
  respondents: string[];
  readable_slug: string;
}

export interface Interview extends InterviewBase, InterviewDetails {}
