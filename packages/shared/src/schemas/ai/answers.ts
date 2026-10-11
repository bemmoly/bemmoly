import { z } from 'zod';
import { aiProviderErrorDetailsSchema, aiRefusalReasonSchema } from './enums.ts';

/** POST /api/v1/ai/answers: a question about the workspace's pages and issues. */
export const aiAnswerRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  /** Retrieval kinds to search ("docs.page", "work.issue"); every kind when absent. */
  kinds: z
    .array(z.string().regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/))
    .min(1)
    .max(10)
    .optional(),
});
export type AiAnswerRequest = z.infer<typeof aiAnswerRequestSchema>;

/** Where a cited chunk sits inside its record. */
export const aiSourceLocationSchema = z.object({
  label: z.string(),
  anchor: z.string().optional(),
  part: z.enum(['body', 'description', 'comment']).optional(),
  commentId: z.string().optional(),
});
export type AiSourceLocation = z.infer<typeof aiSourceLocationSchema>;

/** One citation the answer may point at with its token: "[c3]" is `id: 'c3'`. */
export const aiAnswerSourceSchema = z.object({
  id: z.string().regex(/^c\d+$/),
  kind: z.string(),
  targetId: z.string(),
  title: z.string(),
  /** Opens the record at the location: "/docs/p/…#rollout-plan". */
  href: z.string(),
  location: aiSourceLocationSchema,
  noun: z.object({ one: z.string(), other: z.string() }),
});
export type AiAnswerSource = z.infer<typeof aiAnswerSourceSchema>;

/** How an answer ended: answered from sources, or nothing relevant was found. */
export const AI_ANSWER_OUTCOMES = ['answered', 'no_sources'] as const;
export const aiAnswerOutcomeSchema = z.enum(AI_ANSWER_OUTCOMES);
export type AiAnswerOutcome = z.infer<typeof aiAnswerOutcomeSchema>;

/**
 * The response body is NDJSON, one event per line: `sources` first, then `delta`s as the
 * model writes, then exactly one `done` or `error`. Refusals (AI off, no embedding or standard
 * role, budget spent, opted out) are ordinary 403 responses before the stream starts.
 */
export const aiAnswerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sources'), sources: z.array(aiAnswerSourceSchema) }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    outcome: aiAnswerOutcomeSchema,
    /** The ai_runs row, for "Not useful"; null when no model was asked. */
    runId: z.string().nullable(),
    text: z.string(),
    /** The citation ids the answer used, in first-use order. */
    cited: z.array(z.string()),
  }),
  z.object({
    type: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z
        .union([aiProviderErrorDetailsSchema, z.object({ reason: aiRefusalReasonSchema }).loose()])
        .optional(),
    }),
  }),
]);
export type AiAnswerEvent = z.infer<typeof aiAnswerEventSchema>;

export const AI_ANSWER_CONTENT_TYPE = 'application/x-ndjson';
