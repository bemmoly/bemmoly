import { z } from 'zod';

/*
 * AI inside the Docs editor:
 *   POST /api/v1/docs/pages/:pageId/completions   ghost text, the fast role, 1.5 s
 *   POST /api/v1/docs/pages/:pageId/ai-writes     an /ai command, streamed as NDJSON
 *   POST /api/v1/docs/comments/:commentId/suggest-fix   a fix on an inline thread
 * Each needs edit rights on the page and refuses (403, details.reason) when AI is off, the
 * space is excluded or the workspace does not share content with AI. Nothing here writes to
 * the page: ghost text and writes are shown as suggestions, and a fix is applied by the
 * existing apply-suggestion path.
 */

/** The text around the caret, as the editor sends it. */
export const completionBodySchema = z.object({
  before: z.string().max(2000),
  after: z.string().max(500).default(''),
});

/** null when the model had nothing worth showing. */
export const completionResponseSchema = z.object({
  text: z.string().max(400).nullable(),
});

/** The /ai commands the server writes; the editor's ids. */
export const DOCS_AI_COMMANDS = [
  'continue',
  'summarize-comments',
  'create-issues',
  'summarize',
  'draft',
  'improve',
  'shorten',
  'fix-grammar',
  'translate',
  'table',
] as const;
export const docsAiCommandSchema = z.enum(DOCS_AI_COMMANDS);

export const aiWriteBodySchema = z.object({
  command: docsAiCommandSchema,
  /** The selection, or the line at a bare caret. */
  targetText: z.string().max(8000).default(''),
  /** The section around it. */
  sectionText: z.string().max(8000).default(''),
  heading: z.string().max(300).default(''),
});

/**
 * One line of the NDJSON stream: text deltas, then `done` with the run (for "Not useful"),
 * or `error` with the same body an HTTP error would carry, when it fails after streaming
 * began.
 */
export const aiWriteEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('done'), runId: z.string().nullable() }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
]);

/** What the comment-fix prompt must return; validated, repaired once, else a typed failure. */
export const commentFixOutputSchema = z.object({
  replacement: z.string().max(10_000),
  rationale: z.string().max(400),
});

/** The output schema id the prompt names in its frontmatter. */
export const COMMENT_FIX_SCHEMA_ID = 'docs.comment_fix';

export type CompletionBody = z.infer<typeof completionBodySchema>;
export type CompletionResponse = z.infer<typeof completionResponseSchema>;
export type DocsAiCommand = z.infer<typeof docsAiCommandSchema>;
export type AiWriteBody = z.infer<typeof aiWriteBodySchema>;
export type AiWriteStreamEvent = z.infer<typeof aiWriteEventSchema>;
export type CommentFixOutput = z.infer<typeof commentFixOutputSchema>;
