/**
 * The site is light (Classic, which theme.css puts on :root) for every visitor. A dark version
 * in the Ocean preset is built here from the tokens and applies only when the root element has
 * data-theme="dark"; nothing sets it yet, so it is ready for a later toggle. Under it, the
 * [data-theme='dark'] islands (the self-host band, the install pill, code blocks) take Ocean
 * too, so the whole page is one material.
 */
import { contrastCheck } from '@bemmoly/ui/theme';
import { COLOR_TOKENS, themeById, type ColorToken } from '@bemmoly/ui/tokens';

export const DARK_PRESET = 'ocean';

/**
 * Ocean values with two site choices: body copy (tx3) uses Ocean tx2 so secondary text stays
 * clearly readable on navy, and text on accent fills follows contrastCheck: the sky accent is
 * too light for white text, so it gets the deepest Ocean navy instead.
 */
export function darkColors(): Record<ColorToken, string> {
  const ocean = themeById(DARK_PRESET).colors;
  const onAccent = contrastCheck(ocean.ac).level === 'dark-text' ? ocean.bg : ocean['on-ac'];
  return { ...ocean, tx3: ocean.tx2, 'on-ac': onAccent };
}

export function darkSchemeCss(): string {
  const theme = themeById(DARK_PRESET);
  const colors = darkColors();
  const lines = [
    ...COLOR_TOKENS.map((token) => `--${token}:${colors[token]};`),
    `--font-ui:${theme.fontUi};`,
    `--font-code:${theme.fontCode};`,
    'color-scheme:dark;',
  ];
  const selector = "html[data-theme='dark'],html[data-theme='dark'] [data-theme='dark']";
  return `${selector}{${lines.join('')}}`;
}
