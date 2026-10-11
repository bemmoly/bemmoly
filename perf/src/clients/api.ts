/*
 * The one HTTP client of the harness tools: a personal API token, JSON in and out, a timeout
 * on every call, and patience with the per-person rate limit (429 with Retry-After) and a
 * restarting server (502, 503), which a load harness meets as a matter of course.
 */

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 8;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(method: string, path: string, status: number, body: unknown) {
    super(`${method} ${path} answered ${status}: ${JSON.stringify(body).slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

export interface Api {
  readonly baseUrl: string;
  call<T>(method: string, path: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del(path: string): Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelayMs(response: Response, attempt: number): number {
  const header = Number(response.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  return Math.min(10_000, 250 * 2 ** attempt);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createApi(baseUrl: string, token: string): Api {
  const root = baseUrl.replace(/\/$/, '');
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(`${root}/api/v1${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const retriable =
        response.status === 429 || response.status === 502 || response.status === 503;
      if (retriable && attempt < MAX_ATTEMPTS) {
        await response.body?.cancel();
        await sleep(retryDelayMs(response, attempt));
        continue;
      }
      const parsed = await readBody(response);
      if (!response.ok) throw new ApiError(method, path, response.status, parsed);
      return parsed as T;
    }
  }
  return {
    baseUrl: root,
    call,
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body ?? {}),
    patch: (path, body) => call('PATCH', path, body ?? {}),
    del: async (path) => {
      await call('DELETE', path);
    },
  };
}

/** Runs `work` over `items` with at most `width` in flight; results keep the items' order. */
export async function pool<T, R>(
  items: readonly T[],
  width: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return results;
}
