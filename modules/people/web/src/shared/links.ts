import { navigateInApp } from '@bemmoly/core-web';
import type { MouseEvent } from 'react';

/**
 * Plain clicks on same-origin links inside a People screen move through the shell's router,
 * so a link to a profile is a real link (new tab, copy address) that never reloads the app.
 */
export function keepLinksInApp(event: MouseEvent<HTMLElement>): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest?.('a[href]');
  const href = anchor?.getAttribute('href') ?? '';
  if (!href.startsWith('/') || href.startsWith('//') || anchor?.getAttribute('target')) return;
  event.preventDefault();
  navigateInApp(href);
}
