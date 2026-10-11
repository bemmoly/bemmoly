/*
 * Redirect URIs: the only places a code is ever sent. The MCP spec allows https and the
 * loopback interface; a loopback URI matches whatever port the app listens on today
 * (RFC 8252 section 7.3), everything else must match a registered URI exactly.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLoopback(url: URL): boolean {
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/** https, or http on the loopback interface; never a fragment or credentials. */
export function isAcceptableRedirect(value: string): boolean {
  const url = parse(value);
  if (!url || url.hash || url.username || url.password) return false;
  return url.protocol === 'https:' || isLoopback(url);
}

export function redirectMatches(requested: string, registered: readonly string[]): boolean {
  if (!isAcceptableRedirect(requested)) return false;
  if (registered.includes(requested)) return true;
  const asked = parse(requested);
  if (!asked || !isLoopback(asked)) return false;
  return registered.some((entry) => {
    const known = parse(entry);
    return (
      known !== null &&
      isLoopback(known) &&
      known.hostname === asked.hostname &&
      known.pathname === asked.pathname &&
      known.search === asked.search
    );
  });
}

/** The client's redirect with the response parameters added, keeping its own query. */
export function withParams(redirectUri: string, params: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}
