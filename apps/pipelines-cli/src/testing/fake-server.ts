/*
 * A fake Pipelines server for command tests: routes answer by method and path, and every
 * request is recorded with its headers and parsed body.
 */

export interface Recorded {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export type Handler = (request: Recorded) => { status?: number; body?: unknown };

export function fakeServer(routes: Record<string, Handler | Array<ReturnType<Handler>>>) {
  const requests: Recorded[] = [];
  const counters = new Map<string, number>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const raw = typeof init?.body === 'string' ? init.body : '';
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = headers['content-type']?.includes('json')
      ? JSON.parse(raw)
      : raw
        ? Object.fromEntries(new URLSearchParams(raw))
        : undefined;
    const recorded = { method, path: url.pathname, query: url.searchParams, headers, body };
    requests.push(recorded);
    const key = `${method} ${url.pathname}`;
    const route = routes[key];
    if (!route)
      return new Response(JSON.stringify({ code: 'not_found', message: `No route ${key}` }), {
        status: 404,
      });
    let answer: ReturnType<Handler>;
    if (Array.isArray(route)) {
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      answer = route[Math.min(index, route.length - 1)] ?? {};
    } else {
      answer = route(recorded);
    }
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, requests };
}
