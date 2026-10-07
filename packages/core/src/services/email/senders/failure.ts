import type { SmtpStage } from '@bemmoly/shared';
import { ProviderError } from '@bemmoly/shared';

/** A sender failure in plain words, as stored on the outbox row and shown in Settings. */
export interface EmailFailure {
  stage: SmtpStage;
  message: string;
  serverResponse: string | null;
  /** Worth retrying later: the server or network may recover on its own. */
  transient: boolean;
}

export interface EmailFailureDetails {
  stage: SmtpStage;
  serverResponse: string | null;
  transient: boolean;
}

export function toProviderError(provider: string, failure: EmailFailure, cause: unknown) {
  const details: EmailFailureDetails = {
    stage: failure.stage,
    serverResponse: failure.serverResponse,
    transient: failure.transient,
  };
  return new ProviderError(failure.message, { provider, details, cause });
}

/** Reads the failure back from a ProviderError thrown by any sender. */
export function failureOf(error: unknown): EmailFailure {
  if (error instanceof ProviderError) {
    const details = error.details as Partial<EmailFailureDetails> | undefined;
    return {
      stage: details?.stage ?? 'send',
      message: error.message,
      serverResponse: details?.serverResponse ?? null,
      transient: details?.transient ?? true,
    };
  }
  return {
    stage: 'send',
    message: error instanceof Error ? error.message : 'The email could not be sent',
    serverResponse: null,
    transient: true,
  };
}
