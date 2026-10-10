import type { z } from 'zod';
import { ApiError, errorFromResponse } from './errors.ts';
import type { Http } from './http.ts';

/*
 * Streamed answers (an /ai write, an AI answer) come as NDJSON: one JSON object per line,
 * flushed as the model writes. A refusal before the stream starts is an ordinary error
 * response and throws ApiError, like any other call; each line after that is validated
 * against the event schema.
 */

export interface NdjsonOptions {
  body?: unknown;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

async function errorOf(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    body = undefined;
  }
  return errorFromResponse(response, body);
}

function parseLine<S extends z.ZodType>(line: string, schema: S, path: string): z.output<S> {
  const parsed = schema.safeParse(JSON.parse(line) as unknown);
  if (!parsed.success) {
    throw new ApiError(200, 'invalid_response', `Unexpected stream line from ${path}`, {
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}

/** POSTs to `path` and yields each line of the NDJSON reply as it arrives. */
export async function* streamNdjson<S extends z.ZodType>(
  http: Pick<Http, 'url'>,
  path: string,
  schema: S,
  options: NdjsonOptions = {},
): AsyncIterable<z.output<S>> {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  let response: Response;
  try {
    response = await doFetch(http.url(path), {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/x-ndjson', 'content-type': 'application/json' },
      body: JSON.stringify(options.body ?? {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0, 'network_error', 'Bemmoly could not reach the server.', { cause });
  }
  if (!response.ok) throw await errorOf(response);
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) yield parseLine(line, schema, path);
        newline = pending.indexOf('\n');
      }
    }
    if (pending.trim()) yield parseLine(pending.trim(), schema, path);
  } finally {
    reader.releaseLock();
  }
}
