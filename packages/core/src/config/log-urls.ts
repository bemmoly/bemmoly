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

/** Web pages an email link opens with the token as the next path segment. */
const WEB_TOKEN_PREFIXES = ['/invitations/', '/password-reset/'];

/** Web pages an email link opens with the token anywhere after the page's path. */
const WEB_TOKEN_PAGES = ['/accept-invitation', '/reset-password'];

function tokenPage(path: string): string | undefined {
  return WEB_TOKEN_PAGES.find((page) => path === page || path.startsWith(`${page}/`));
}

function redactWebPath(path: string): string | undefined {
  const page = tokenPage(path);
  if (page) return path === page ? path : `${page}/${REDACTED}`;
  const prefix = WEB_TOKEN_PREFIXES.find((candidate) => path.startsWith(candidate));
  if (!prefix) return undefined;
  const rest = path.slice(prefix.length).split('/').slice(1);
  return [`${prefix}${REDACTED}`, ...rest].join('/');
}

function redactPath(path: string): string {
  const web = redactWebPath(path);
  if (web !== undefined) return web;
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

/** On a token page every parameter is treated as the credential, whatever its name. */
function redactQuery(query: string, everything: boolean): string {
  return query
    .split('&')
    .map((pair) => {
      const raw = pair.split('=')[0] ?? '';
      const name = safeDecode(raw).toLowerCase();
      return everything || SECRET_PARAMS.has(name) ? `${raw}=${REDACTED}` : pair;
    })
    .join('&');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return redactPath(url);
  const path = url.slice(0, queryStart);
  const everything = tokenPage(path) !== undefined;
  return `${redactPath(path)}?${redactQuery(url.slice(queryStart + 1), everything)}`;
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
