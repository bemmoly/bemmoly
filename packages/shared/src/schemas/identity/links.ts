/**
 * The web routes that invitation and password reset links open. The server builds the links
 * from these and the web router registers the same paths; a web test holds the two together.
 */
export const ACCEPT_INVITATION_PATH = 'accept-invitation';
export const RESET_PASSWORD_PATH = 'reset-password';

/**
 * A link path carrying a one-time token in the fragment (#token=…). Browsers never send the
 * fragment, so the token stays out of server, proxy and referrer logs.
 */
export function tokenLinkPath(path: string, token: string): string {
  return `${path}#token=${encodeURIComponent(token)}`;
}

/** The token in such a link, or undefined when it has none. */
export function tokenOfLink(url: string): string | undefined {
  return new URLSearchParams(new URL(url).hash.slice(1)).get('token') ?? undefined;
}
