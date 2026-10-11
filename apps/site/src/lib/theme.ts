/**
 * The theme variables the site needs, built from @bemmoly/ui's tokens at build time and
 * inlined in every page, so the site cannot drift from the product. One theme only, Bemmoly,
 * in its light and dark sets (ADR 0021), so visitors do not download the other four.
 *
 * - Light on :root.
 * - Dark when the visitor's system asks for it, unless they chose light in the footer
 *   (html[data-theme='light']), and whenever html[data-theme='dark'] is set.
 * - [data-theme='dark'] on an element makes a dark island on a light page: the self-hosting
 *   band and the terminal blocks, which are dark in both versions, as in the product.
 */
import {
  COLOR_TOKENS,
  EASE,
  ELEVATIONS,
  FIXED_COLORS,
  FOCUS,
  FONTS,
  METRICS,
  MODE_TYPE_COLORS,
  MONO_STACK,
  MOTION,
  resolveTheme,
  SHADOWS,
  type ResolvedTheme,
} from '@bemmoly/ui/tokens';

const vars = (prefix: string, scale: Readonly<Record<string, string>>) =>
  Object.entries(scale).map(([name, value]) => `--${prefix}${name}:${value};`);

/** One theme mode's colours and elevations, as declarations; dark lifts Task and Epic. */
export function declarations(theme: ResolvedTheme): string {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}:${theme.colors[token]};`),
    ...vars('', MODE_TYPE_COLORS[theme.mode]),
    ...vars('', ELEVATIONS[theme.mode]),
    `color-scheme:${theme.mode};`,
  ].join('');
}

export function themeCss(): string {
  const light = resolveTheme('bemmoly', 'light');
  const dark = declarations(resolveTheme('bemmoly', 'dark'));
  const base = [
    ...vars('', METRICS),
    ...vars('', FIXED_COLORS),
    ...vars('', FOCUS),
    ...vars('shadow-', SHADOWS),
    ...vars('duration-', MOTION),
    ...vars('ease-', EASE),
    `--font-ui:${FONTS.plex.stack};`,
    `--font-code:${MONO_STACK};`,
  ];
  return [
    `:root{${base.join('')}${declarations(light)}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme='light']){${dark}}}`,
    `[data-theme='dark']{${dark}}`,
  ].join('');
}
