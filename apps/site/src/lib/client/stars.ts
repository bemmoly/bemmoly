/**
 * The star count in the header (Nav.astro) is fetched at build time, so it goes stale between
 * deploys. Ask GitHub again in the browser and replace it; any failure keeps the built number.
 */
import { fetchFacts, formatCount } from '../clients/github.ts';

export function enhanceStars(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-star]');
  if (links.length === 0) return;
  void fetchFacts().then((facts) => {
    if (!facts) return;
    for (const link of links) {
      const count = link.querySelector<HTMLElement>('[data-star-count]');
      if (!count) continue;
      count.textContent = formatCount(facts.stars);
      count.hidden = false;
      link.setAttribute('aria-label', `Bemmoly on GitHub, ${facts.stars} stars`);
    }
  });
}
