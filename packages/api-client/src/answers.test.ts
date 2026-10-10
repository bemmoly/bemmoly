import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient, isApiError } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** NDJSON split across chunks at awkward places, as a network delivers it. */
function ndjson(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new HttpResponse(body, { headers: { 'content-type': 'application/x-ndjson' } });
}

describe('answers', () => {
  it('yields each event as its line completes', async () => {
    server.use(
      route.post(`${BASE}/api/v1/ai/answers`, () =>
        ndjson([
          '{"type":"sources","sources":[]}\n{"type":"del',
          'ta","text":"Flip it [c1]."}\n',
          '{"type":"done","outcome":"answered","runId":"r1","text":"Flip it [c1].","cited":[]}',
        ]),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    const seen: string[] = [];
    for await (const event of api.ai.answers.stream({ question: 'How?' })) seen.push(event.type);
    expect(seen).toEqual(['sources', 'delta', 'done']);
  });

  it('throws the refusal before any event', async () => {
    server.use(
      route.post(`${BASE}/api/v1/ai/answers`, () =>
        HttpResponse.json(
          {
            code: 'forbidden',
            message: 'AI is off',
            details: { reason: 'ai_off' },
            requestId: 'r',
          },
          { status: 403 },
        ),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    const stream = api.ai.answers.stream({ question: 'How?' });
    const error = await stream.next().catch((caught: unknown) => caught);
    expect(isApiError(error) && error.details).toEqual({ reason: 'ai_off' });
  });

  it('refuses an empty question without calling the server', async () => {
    const api = createApiClient({ fetch: absolute });
    await expect(api.ai.answers.stream({ question: '  ' }).next()).rejects.toMatchObject({
      code: 'validation_failed',
    });
  });

  it('marks a run not useful', async () => {
    let body: unknown;
    server.use(
      route.put(`${BASE}/api/v1/ai/runs/r1/feedback`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await createApiClient({ fetch: absolute }).ai.answers.feedback('r1', 'not_useful');
    expect(body).toEqual({ feedback: 'not_useful' });
  });
});
