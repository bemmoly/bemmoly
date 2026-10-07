import { z } from 'zod';
import { errorCodeSchema } from '../../errors/codes.ts';

/** The one error body every API endpoint returns. */
export const apiErrorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
