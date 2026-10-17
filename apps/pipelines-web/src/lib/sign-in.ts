/** Where the app lives on the origin; the router and every in-app link are under it. */
export const BASE_PATH = '/pipelines';

/**
 * Bemmoly's sign-in page, with the way back here. Sign-in, single sign-on and the session are
 * the kernel's and shared on this origin, so Pipelines never draws its own (ADR 0037).
 */
export function signInUrl(location: Pick<Location, 'pathname' | 'search'>): string {
  const back = `${location.pathname}${location.search}`;
  const target = back.startsWith(BASE_PATH) ? back : `${BASE_PATH}/`;
  return `/login?redirect=${encodeURIComponent(target)}`;
}

export function goToSignIn(): void {
  window.location.assign(signInUrl(window.location));
}
