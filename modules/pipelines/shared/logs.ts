import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common.ts';

/*
 * Job logs: GET /api/v1/pipelines/jobs/:id/logs?from=&to=&step= reads a range of lines,
 * GET /jobs/:id/logs/search?q= finds lines, and the stream topic `job:<id>:log` appends live.
 * Logs live in object storage in ordered chunks; the chunk index says which object holds
 * which lines, so a range read never scans the whole log.
 */

export const logChunkSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  stepId: idSchema.nullable(),
  seq: z.number().int().min(0),
  firstLine: z.number().int().min(1),
  lineCount: z.number().int().min(0),
  byteSize: z.number().int().min(0),
  hasError: z.boolean(),
  createdAt: isoDateTimeSchema,
});

/**
 * ANSI colours mapped onto tokens: the LogView draws each kind with a token, never the
 * colour the program asked for.
 */
export const logSpanKindSchema = z.enum([
  'plain',
  'dim',
  'bold',
  'error',
  'warning',
  'success',
  'info',
  'accent',
  'link',
]);

export const logSpanSchema = z.object({
  text: z.string(),
  kind: logSpanKindSchema,
  /** For kind "link": where it goes. */
  href: z.string().optional(),
});

export const logLineSchema = z.object({
  number: z.number().int().min(1),
  /** The line with escape codes removed, for copying and search. */
  text: z.string(),
  spans: z.array(logSpanSchema),
  /** Drawn on red-50 and offered by "next error". */
  error: z.boolean(),
  stepId: idSchema.nullable(),
});

export const logRangeQuerySchema = z.object({
  /** First line, 1-based; omitted reads from the start (or the tail with `tail`). */
  from: z.coerce.number().int().min(1).optional(),
  to: z.coerce.number().int().min(1).optional(),
  step: idSchema.optional(),
  /** Read the last N lines instead of a range. */
  tail: z.coerce.number().int().min(1).max(5000).optional(),
});

export const logRangeSchema = z.object({
  jobId: idSchema,
  lines: z.array(logLineSchema),
  /** Lines written so far; grows while the job runs. */
  totalLines: z.number().int().min(0),
  /** False while the job still writes; the view follows the stream. */
  complete: z.boolean(),
  /** The first error line, so the screen opens on the failure. */
  firstErrorLine: z.number().int().nullable(),
});

export const logSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  step: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const logSearchSchema = z.object({
  matches: z.array(
    z.object({
      line: z.number().int().min(1),
      text: z.string(),
      /** Character offsets of each hit in `text`. */
      ranges: z.array(z.tuple([z.number().int(), z.number().int()])),
    }),
  ),
  /** True when there were more matches than `limit`. */
  truncated: z.boolean(),
});

/** What the `job:<id>:log` stream topic carries: lines appended since `fromLine`. */
export const logAppendedSchema = z.object({
  jobId: idSchema,
  fromLine: z.number().int().min(1),
  lines: z.array(logLineSchema),
});

export const jobParamsSchema = z.object({ id: idSchema });

export type LogChunk = z.infer<typeof logChunkSchema>;
export type LogSpanKind = z.infer<typeof logSpanKindSchema>;
export type LogSpan = z.infer<typeof logSpanSchema>;
export type LogLine = z.infer<typeof logLineSchema>;
export type LogRangeQuery = z.infer<typeof logRangeQuerySchema>;
export type LogRange = z.infer<typeof logRangeSchema>;
export type LogSearchQuery = z.infer<typeof logSearchQuerySchema>;
export type LogSearch = z.infer<typeof logSearchSchema>;
export type LogAppended = z.infer<typeof logAppendedSchema>;
