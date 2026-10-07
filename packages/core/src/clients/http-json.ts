export interface JsonRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  timeoutMs: number;
  /** Responses larger than this are refused. */
  maxBytes?: number;
}

export class HttpStatusError extends Error {
  override readonly name = 'HttpStatusError';
  readonly status: number;
  readonly body: string;

  constructor(url: string, status: number, body: string) {
    super(`${url} answered ${status}`);
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_MAX_BYTES = 1024 * 1024;

/** One JSON request with a hard timeout and a size cap; non-2xx throws HttpStatusError. */
export async function requestJson(request: JsonRequest): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...request.headers,
    },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    signal: AbortSignal.timeout(request.timeoutMs),
    redirect: 'follow',
  });
  const text = await response.text();
  if (text.length > (request.maxBytes ?? DEFAULT_MAX_BYTES)) {
    throw new Error(
      `${request.url} returned more than ${request.maxBytes ?? DEFAULT_MAX_BYTES} bytes`,
    );
  }
  if (!response.ok) throw new HttpStatusError(request.url, response.status, text.slice(0, 2_000));
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}
