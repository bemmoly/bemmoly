import { createGuardedFetch, type AddressPolicy } from './guarded-fetch.ts';
import { HttpStatusError } from './http-json.ts';

/** A metadata document is a few hundred bytes; anything slower or larger is not one. */
export const CLIENT_METADATA_TIMEOUT_MS = 5_000;
export const CLIENT_METADATA_MAX_BYTES = 16 * 1024;

export interface ClientMetadataResponse {
  body: unknown;
  /** From Cache-Control: seconds the document may be reused; null when it does not say. */
  maxAgeSeconds: number | null;
}

export type FetchClientMetadata = (url: string) => Promise<ClientMetadataResponse>;

export class ClientMetadataError extends Error {
  override readonly name = 'ClientMetadataError';
}

function maxAgeOf(header: string | null): number | null {
  if (!header) return null;
  if (/(^|,)\s*(no-store|no-cache)\s*(,|$)/i.test(header)) return 0;
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(header);
  return match ? Number(match[1]) : null;
}

async function readCapped(response: Response, url: string): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > CLIENT_METADATA_MAX_BYTES) {
    throw new ClientMetadataError(`${url} is larger than a client metadata document can be`);
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > CLIENT_METADATA_MAX_BYTES) {
      await reader.cancel();
      throw new ClientMetadataError(`${url} is larger than a client metadata document can be`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Fetches an MCP client's metadata document (its client id is the document's https address).
 * The address comes from whoever starts an authorization, so every call is checked against the
 * address policy, never follows a redirect, carries a hard timeout and reads at most 16 KB.
 */
export function createClientMetadataFetch(
  policy: AddressPolicy,
  base: typeof fetch = fetch,
): FetchClientMetadata {
  const guarded = createGuardedFetch(policy, base);
  return async (url) => {
    const response = await guarded(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CLIENT_METADATA_TIMEOUT_MS),
    });
    if (!response.ok) throw new HttpStatusError(url, response.status, '');
    const text = await readCapped(response, url);
    try {
      return {
        body: JSON.parse(text) as unknown,
        maxAgeSeconds: maxAgeOf(response.headers.get('cache-control')),
      };
    } catch {
      throw new ClientMetadataError(`${url} did not answer with JSON`);
    }
  };
}
