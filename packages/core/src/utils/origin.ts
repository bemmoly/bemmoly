import type { IncomingHttpHeaders } from 'node:http';

function originOf(value: string | undefined): string | null {
  if (!value || value === 'null') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Where a browser says a request came from: the Origin header, or the Referer's
 * origin when Origin is absent. Null when neither is present or parseable.
 */
export function requestOrigin(headers: IncomingHttpHeaders): string | null {
  return originOf(first(headers.origin)) ?? originOf(first(headers.referer));
}

/**
 * Same-origin means the workspace's public URL, or the host the request was
 * addressed to (an admin opening the server by IP). A cross-site page cannot
 * forge either, because the browser sets Origin and Host.
 */
export function isSameOrigin(
  origin: string,
  publicUrl: string,
  request: { protocol: string; host: string | undefined },
): boolean {
  if (origin === new URL(publicUrl).origin) return true;
  return Boolean(request.host) && origin === `${request.protocol}://${request.host}`;
}
