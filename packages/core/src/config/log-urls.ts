/**
 * Credentials that travel in URLs (invitation links, one-time auth tokens) are removed
 * before a URL reaches a log line. Used by the logger's `req` serializer and for any
 * `url` field logged directly.
 */

const REDACTED = '[redacted]';

/** Opaque tokens are 32 random bytes in base64url: 43 characters. */
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{43}$/;

/** Query parameters that carry a credential. */
const SECRET_PARAMS = new Set(['token', 'code', 'invitation', 'state', 'access_token']);

function redactPath(path: string): string {
  const marker = path.indexOf('/auth/');
  if (marker === -1) return path;
  const head = path.slice(0, marker + '/auth/'.length);
  const segments = path.slice(head.length).split('/');
  return (
    head +
    segments
      .map((segment, index) =>
        segments[index - 1] === 'invitations' || TOKEN_SEGMENT.test(segment) ? REDACTED : segment,
      )
      .join('/')
  );
}

function redactQuery(query: string): string {
  return query
    .split('&')
    .map((pair) => {
      const name = decodeURIComponent(pair.split('=')[0] ?? '').toLowerCase();
      return SECRET_PARAMS.has(name) ? `${pair.split('=')[0]}=${REDACTED}` : pair;
    })
    .join('&');
}

export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return redactPath(url);
  return `${redactPath(url.slice(0, queryStart))}?${redactQuery(url.slice(queryStart + 1))}`;
}

interface LoggableRequest {
  method?: string;
  url?: string;
  hostname?: string;
  ip?: string;
  socket?: { remotePort?: number | undefined } | null;
}

/** Replaces Fastify's default `req` serializer: the same fields, with the URL redacted. */
export function serializeRequest(request: LoggableRequest): Record<string, unknown> {
  return {
    method: request.method,
    url: request.url === undefined ? undefined : redactUrl(request.url),
    host: request.hostname,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  };
}
