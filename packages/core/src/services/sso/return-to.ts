const PROBE_ORIGIN = 'http://return-to.invalid';

/**
 * Where to land after signing in: a path inside this workspace, or the home page. Absolute
 * URLs, protocol-relative `//host`, backslash tricks and control characters all fall back to
 * `/`, so the sign-in flow can never be used to bounce someone to another site.
 */
export function safeReturnTo(value: string | undefined | null): string {
  if (!value || value.length > 2048) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if ([...value].some((char) => char.charCodeAt(0) < 0x20 || char === '\u007f' || char === '\\')) {
    return '/';
  }
  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
