import type { z } from 'zod';
import { ValidationError } from '../errors/errors.ts';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

/** Validates once at the edge and throws the shared ValidationError on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('The request is not valid', {
      details: { issues: toValidationIssues(result.error) },
    });
  }
  return result.data;
}
