import { createGuardedFetch, type AddressPolicy } from './guarded-fetch.ts';

export interface WebhookPost {
  url: string;
  body: string;
  headers: Readonly<Record<string, string>>;
}

export interface WebhookAnswer {
  status: number;
  /** The start of the receiver's answer, for the delivery log. */
  excerpt: string;
}

export interface WebhookClient {
  post(request: WebhookPost): Promise<WebhookAnswer>;
}

export interface WebhookClientOptions {
  /** `public` refuses private, loopback and link-local targets; `any` with BEMMOLY_ALLOW_PRIVATE_URLS. */
  policy: AddressPolicy;
  /** For the whole call: connect, send and read the answer's start. */
  timeoutMs: number;
  fetch?: typeof fetch;
}

export class WebhookTimeoutError extends Error {
  override readonly name = 'WebhookTimeoutError';
}

const EXCERPT_BYTES = 2_048;

async function readExcerpt(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < EXCERPT_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).subarray(0, EXCERPT_BYTES).toString('utf8');
}

/**
 * Posts one signed delivery. The target's address is checked under the policy at the moment
 * of the call, a redirect is refused rather than followed (it could lead a public address to a
 * private one), and the whole call shares one timeout. Only the start of the answer is read.
 */
export function createWebhookClient(options: WebhookClientOptions): WebhookClient {
  const guarded = createGuardedFetch(options.policy, options.fetch ?? fetch);
  return {
    async post(request) {
      const signal = AbortSignal.timeout(options.timeoutMs);
      try {
        const response = await guarded(request.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...request.headers },
          body: request.body,
          signal,
        });
        return { status: response.status, excerpt: await readExcerpt(response) };
      } catch (error) {
        if (signal.aborted) {
          throw new WebhookTimeoutError(
            `The receiver did not answer within ${options.timeoutMs / 1000} seconds`,
            { cause: error },
          );
        }
        throw error;
      }
    },
  };
}
