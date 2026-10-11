/**
 * The site's one script, loaded by every page (Base.astro). Each part finds its own markup by
 * a data attribute and does nothing on a page without it, and every page works without the
 * script: commands are selectable text, tabs are links, the footer's theme control stays
 * hidden and the page follows the system's colour scheme.
 */
import { enhanceCopy } from './copy.ts';
import { enhanceMenu } from './menu.ts';
import { enhancePreviews } from './preview.ts';
import { enhanceShare } from './share.ts';
import { enhanceTabs } from './tabs.ts';
import { enhanceTheme } from './theme.ts';

export function start(): void {
  enhanceMenu();
  enhanceTheme();
  enhanceCopy();
  enhanceShare();
  enhanceTabs();
  enhancePreviews();
}
