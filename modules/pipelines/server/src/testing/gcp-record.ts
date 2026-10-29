import { fetchTransport, type GcpTransport } from '../clients/gcp/index.ts';
import type { FixtureFile, RecordedExchange } from './gcp-replay.ts';

/*
 * The other half of gcp-replay.ts: a transport that calls Google for real and keeps every
 * exchange, so a run against a sandbox organisation becomes a fixture file. Tokens never
 * reach a fixture: request headers are not kept, and any token in an answer is replaced.
 */

const TOKEN_FIELDS = new Set(['access_token', 'accessToken', 'id_token', 'token']);

/** Replaces every token-looking field, at any depth, with a placeholder. */
export function redactTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTokens);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
      key,
      TOKEN_FIELDS.has(key) && typeof inner === 'string' ? 'redacted' : redactTokens(inner),
    ]),
  );
}

const parse = (text: string | undefined): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
};

export function createRecordingTransport(real: GcpTransport = fetchTransport) {
  const exchanges: RecordedExchange[] = [];
  const transport: GcpTransport = async (url, init) => {
    const response = await real(url, init);
    const text = await response.text();
    const body = parse(init.body);
    exchanges.push({
      method: init.method,
      url,
      ...(body === undefined ? {} : { body: redactTokens(body) }),
      ...(response.status === 200 ? {} : { status: response.status }),
      ...(text ? { response: redactTokens(parse(text)) } : {}),
    });
    return new Response(response.status === 204 ? null : text, { status: response.status });
  };
  return {
    transport,
    /** Everything recorded since the last take, as a fixture file. */
    take(note: string): FixtureFile {
      return { recorded: note, exchanges: exchanges.splice(0) };
    },
  };
}
