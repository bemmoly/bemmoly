/**
 * Keeps the shell's root-relative addresses under the base it is served from.
 *
 * The shell's router reads the base (vite `base`, router `basepath`), but module chunks move
 * with `history.pushState('/work/…')` and render plain `<a href="/work/…">` links, as they may
 * on an install, which is always served at the root. The demo is served at bemmoly.com/demo,
 * so this prefixes those addresses as they are used instead of teaching every module about a
 * base an install never has.
 */
export function underBase(base: string, url: string): string {
  const prefix = base.replace(/\/$/, '');
  if (!prefix || !url.startsWith('/') || url.startsWith('//')) return url;
  const rest = url.startsWith(prefix) ? url.slice(prefix.length) : null;
  if (rest !== null && (rest === '' || /^[/?#]/.test(rest))) return url;
  return `${prefix}${url}`;
}

/** Patches the history API and the links inside `root` so they stay under `base`. */
export function keepUnderBase(base: string, root: HTMLElement): void {
  const fix = (url: string | URL | null | undefined) =>
    typeof url === 'string' ? underBase(base, url) : url;
  const { pushState, replaceState } = window.history;
  window.history.pushState = function (state, unused, url) {
    pushState.call(this, state, unused, fix(url));
  };
  window.history.replaceState = function (state, unused, url) {
    replaceState.call(this, state, unused, fix(url));
  };
  /** Rewrites a link's href just before the browser follows, copies or previews it. */
  const retarget = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[href^="/"]');
    if (!link || !root.contains(link)) return;
    const href = link.getAttribute('href') ?? '';
    const next = underBase(base, href);
    if (next !== href) link.setAttribute('href', next);
  };
  for (const type of ['pointerdown', 'focusin', 'click', 'auxclick', 'contextmenu']) {
    document.addEventListener(type, retarget, true);
  }
}
