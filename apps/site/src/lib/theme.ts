/**
 * The theme variables the site needs, built from @bemmoly/ui's tokens at build time and
 * inlined in every page. It is the same output as @bemmoly/ui/theme.css, limited to the three
 * presets the site uses, so visitors do not download the other six.
 *
 * - Classic on :root: the site is light for every visitor.
 * - Dark on [data-theme='dark']: the Landing mock's dark band and install pill.
 * - Ocean on html[data-theme='dark'] and its dark islands: a dark version of the whole page,
 *   ready for a later toggle; nothing sets the attribute yet.
 */
import { contrastCheck } from '@bemmoly/ui/theme';
import {
  COLOR_TOKENS,
  METRICS,
  MOTION,
  SHADOWS,
  themeById,
  type ColorToken,
  type ResolvedTheme,
} from '@bemmoly/ui/tokens';

export const DARK_PRESET = 'ocean';

/**
 * Ocean values with one site choice: text on accent fills follows contrastCheck, so the sky
 * accent, too light for white text, gets the deepest Ocean navy instead.
 */
export function darkColors(): Record<ColorToken, string> {
  const ocean = themeById(DARK_PRESET).colors;
  const onAccent = contrastCheck(ocean.acc).level === 'dark-text' ? ocean.sunken : ocean['on-acc'];
  return { ...ocean, 'on-acc': onAccent };
}

const vars = (prefix: string, scale: Readonly<Record<string, string>>) =>
  Object.entries(scale).map(([name, value]) => `--${prefix}${name}:${value};`);

function declarations(theme: ResolvedTheme, colors: Record<ColorToken, string>): string {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}:${colors[token]};`),
    `--font-ui:${theme.fontUi};`,
    `--font-code:${theme.fontCode};`,
    `color-scheme:${theme.mode};`,
  ].join('');
}

export function themeCss(): string {
  const classic = themeById('light');
  const dark = themeById('dark');
  const ocean = themeById(DARK_PRESET);
  const base = [...vars('', METRICS), ...vars('shadow-', SHADOWS), ...vars('duration-', MOTION)];
  return [
    `:root{${base.join('')}${declarations(classic, classic.colors)}}`,
    `[data-theme='dark']{${declarations(dark, dark.colors)}}`,
    `html[data-theme='dark'],html[data-theme='dark'] [data-theme='dark']{${declarations(ocean, darkColors())}}`,
  ].join('');
}
