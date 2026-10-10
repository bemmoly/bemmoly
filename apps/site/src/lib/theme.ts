/**
 * The theme variables the site needs, built from @bemmoly/ui's tokens at build time and
 * inlined in every page, so the site cannot drift from the product. Two presets only, the
 * product's own light and dark (ADR 0015), so visitors do not download the other six.
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
  METRICS,
  MOTION,
  SHADOWS,
  themeById,
  type ResolvedTheme,
} from '@bemmoly/ui/tokens';

const vars = (prefix: string, scale: Readonly<Record<string, string>>) =>
  Object.entries(scale).map(([name, value]) => `--${prefix}${name}:${value};`);

/** One preset's colours, elevations and fonts, as declarations. */
export function declarations(theme: ResolvedTheme): string {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}:${theme.colors[token]};`),
    ...vars('', ELEVATIONS[theme.mode]),
    `--font-ui:${theme.fontUi};`,
    `--font-code:${theme.fontCode};`,
    `color-scheme:${theme.mode};`,
  ].join('');
}

export function themeCss(): string {
  const light = themeById('light');
  const dark = declarations(themeById('dark'));
  const base = [
    ...vars('', METRICS),
    ...vars('', FIXED_COLORS),
    ...vars('', FOCUS),
    ...vars('shadow-', SHADOWS),
    ...vars('duration-', MOTION),
    ...vars('ease-', EASE),
  ];
  return [
    `:root{${base.join('')}${declarations(light)}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme='light']){${dark}}}`,
    `[data-theme='dark']{${dark}}`,
  ].join('');
}
