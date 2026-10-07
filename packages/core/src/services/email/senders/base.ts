import type {
  EmailCallOptions,
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from '../../../contracts/email-sender.ts';
import { toProviderError, type EmailFailure } from './failure.ts';

/** What one transport implements; timeouts, retries and error shape come from the base. */
export interface SenderDriver {
  readonly id: string;
  deliver(message: EmailMessage, signal: AbortSignal): Promise<EmailSendResult>;
  check(signal: AbortSignal): Promise<void>;
  /** Translates the transport's own error into plain words. */
  describe(error: unknown, phase: 'check' | 'deliver'): EmailFailure;
}

export interface SenderPolicy {
  /** Whole-call budget, including retries. */
  timeoutMs: number;
  /** Immediate retries of a transient failure inside one call; the outbox adds slow retries. */
  retries: number;
  retryDelayMs: number;
}

export const DEFAULT_SENDER_POLICY: SenderPolicy = {
  timeoutMs: 30_000,
  retries: 1,
  retryDelayMs: 500,
};

class SenderTimeoutError extends Error {
  override readonly name = 'SenderTimeoutError';
}

function combinedSignal(timeoutMs: number, outer: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return outer ? AbortSignal.any([timeout, outer]) : timeout;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSender(driver: SenderDriver, policy = DEFAULT_SENDER_POLICY): EmailSender {
  async function run<T>(
    phase: 'check' | 'deliver',
    work: (signal: AbortSignal) => Promise<T>,
    options?: EmailCallOptions,
  ): Promise<T> {
    const signal = combinedSignal(policy.timeoutMs, options?.signal);
    for (let attempt = 0; ; attempt += 1) {
      try {
        if (signal.aborted) {
          throw new SenderTimeoutError(`No answer within ${policy.timeoutMs / 1000} seconds`);
        }
        return await work(signal);
      } catch (caught) {
        const error =
          signal.aborted && !(caught instanceof SenderTimeoutError)
            ? new SenderTimeoutError(`No answer within ${policy.timeoutMs / 1000} seconds`, {
                cause: caught,
              })
            : caught;
        const failure =
          error instanceof SenderTimeoutError
            ? {
                stage: phase === 'check' ? ('connect' as const) : ('send' as const),
                message: `The mail server did not answer within ${policy.timeoutMs / 1000} seconds.`,
                serverResponse: null,
                transient: true,
              }
            : driver.describe(error, phase);
        if (!failure.transient || attempt >= policy.retries || signal.aborted) {
          throw toProviderError(driver.id, failure, error);
        }
        await wait(policy.retryDelayMs * (attempt + 1));
      }
    }
  }

  return {
    id: driver.id,
    send: (message, options) =>
      run('deliver', (signal) => driver.deliver(message, signal), options),
    verify: (options) => run('check', (signal) => driver.check(signal), options),
  };
}
