/**
 * The star count in the header (Nav.astro) is fetched at build time, so it goes stale between
 * deploys. Ask GitHub again in the browser and replace it; any failure keeps the built number.
 */
import { formatCount } from '../clients/github.ts';
import { REPO_URL } from '../links.ts';

const API = REPO_URL.replace('https://github.com/', 'https://api.github.com/repos/');

export function enhanceStars(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-star]');
  if (links.length === 0) return;
  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { stargazers_count?: unknown } | null) => {
      const stars = body?.stargazers_count;
      if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 0) return;
      for (const link of links) {
        const count = link.querySelector<HTMLElement>('[data-star-count]');
        if (!count) continue;
        count.textContent = formatCount(stars);
        count.hidden = false;
        link.setAttribute('aria-label', `Bemmoly on GitHub, ${stars} stars`);
      }
    })
    .catch(() => {});
}
