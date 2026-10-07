import { toValidationIssues } from '@bemmoly/shared';
import type { z } from 'zod';
import { ApiError } from '../errors.ts';

/** Request bodies are checked against the shared schema before they leave the browser. */
export function validated<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(0, 'validation_failed', 'The request is not valid', {
      details: { issues: toValidationIssues(result.error) },
    });
  }
  return result.data;
}

export const enc = encodeURIComponent;
