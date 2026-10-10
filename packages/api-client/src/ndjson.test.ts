import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from './errors.ts';
import { createHttp } from './http.ts';
import { streamNdjson } from './ndjson.ts';

const event = z.object({ type: z.string(), text: z.string().optional() });

/** A response whose body arrives in the given pieces, split anywhere. */
function chunked(pieces: string[], init: ResponseInit = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece));
      controller.close();
    },
  });
  return new Response(body, { status: 200, ...init });
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of stream) out.push(item);
  return out;
}

describe('streamNdjson', () => {
  it('yields each line as it completes, however the bytes are split', async () => {
    const http = createHttp();
    const fetch = async () =>
      chunked([
        '{"type":"text","te',
        'xt":"We "}\n{"type":"te',
        'xt","text":"move"}\n{"type":"done"}',
      ]);
    const events = await collect(streamNdjson(http, '/api/v1/x', event, { fetch }));
    expect(events).toEqual([
      { type: 'text', text: 'We ' },
      { type: 'text', text: 'move' },
      { type: 'done' },
    ]);
  });

  it('throws the API error of a refusal before the stream starts', async () => {
    const http = createHttp();
    const fetch = async () =>
      new Response(
        JSON.stringify({ code: 'forbidden', message: 'AI is off', details: { reason: 'ai_off' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    const error = await collect(streamNdjson(http, '/api/v1/x', event, { fetch })).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });

  it('refuses a line that does not match the schema', async () => {
    const http = createHttp();
    const fetch = async () => chunked(['{"nope":1}\n']);
    await expect(collect(streamNdjson(http, '/api/v1/x', event, { fetch }))).rejects.toThrow(
      /Unexpected stream line/,
    );
  });
});
