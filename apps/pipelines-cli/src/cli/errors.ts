import { z } from 'zod';

/** The API's standard error body: `{ code, message, details?, requestId }`. */
export const apiErrorBodySchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

/** OAuth endpoints answer errors as RFC 6749 says: `{ error, error_description? }`. */
export const oauthErrorBodySchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/**
 * Anything bp reports and exits on. The message is what the person reads; an API error keeps
 * its body so a refusal can print why and whom to ask.
 */
export interface CliErrorOptions {
  exitCode?: number;
  status?: number;
  body?: ApiErrorBody;
  /** An OAuth error code (`authorization_pending`, …) from the token endpoint. */
  oauth?: string;
}

export class CliError extends Error {
  override readonly name = 'CliError';
  readonly options: CliErrorOptions;

  constructor(message: string, options: CliErrorOptions = {}) {
    super(message);
    this.options = options;
  }

  get exitCode(): number {
    return this.options.exitCode ?? 1;
  }
}

/** A wrong flag or argument: exit code 2, like other command line tools. */
export const usageError = (message: string) => new CliError(message, { exitCode: 2 });
