import { z } from 'zod';
import { errorCodeSchema } from '../../errors/codes.ts';

/** The one error body every API endpoint returns. */
export const apiErrorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
  /** The catalog id `message` renders, and its values, for clients that translate (ADR 0025). */
  messageId: z.string().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
