import { fieldErrors, isApiError, type ApiError } from '@bemmoly/api-client';
import { translate } from '@bemmoly/core-web';
import { toValidationIssues } from '@bemmoly/shared';
import type { z } from 'zod';
import '../i18n/catalogs.ts';

const COPY: Partial<Record<string, string>> = {
  network_error: 'Bemmoly could not reach the server. Check your connection and try again.',
  rate_limited: 'Too many attempts. Wait a minute, then try again.',
  forbidden: 'You do not have access to do that. Ask an org admin.',
  module_access_denied: 'You do not have access to this module. Ask an org admin.',
  invalid_response: 'The server answered in a way this page did not expect. Reload and try again.',
  client_error: 'Something went wrong on this page. Reload and try again.',
  internal_error: 'Something went wrong on our side. Quote the request id when you report it.',
};

export interface ErrorView {
  message: string;
  requestId: string | undefined;
}

/** The server's message in the person's language, when the body names a message we know. */
function serverMessage(error: ApiError): string {
  if (!error.messageId) return error.message;
  const text = translate(error.messageId, error.values);
  return text === error.messageId ? error.message : text;
}

/** Plain-words copy for any failure; the server's own message wins when it has one. */
export function describeError(error: unknown): ErrorView {
  if (isApiError(error)) {
    const copy = COPY[error.code];
    const useServer = error.code !== 'internal_error' && error.status !== 0 && error.message;
    return {
      message: useServer ? serverMessage(error) : (copy ?? error.message),
      requestId: error.requestId,
    };
  }
  return { message: COPY['internal_error'] as string, requestId: undefined };
}

export type FieldErrors = Partial<Record<string, string>>;

/** Validates a form against its shared schema; returns the data or field messages. */
export function validateForm<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S>; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of toValidationIssues(result.error)) errors[issue.path] ??= issue.message;
  return { data: null, errors };
}

/** Field messages from a server `validation_failed` answer, for the same form. */
export function serverFieldErrors(error: unknown): FieldErrors {
  return fieldErrors(error);
}
