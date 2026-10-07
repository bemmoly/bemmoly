import { COLOR_TOKENS, DEFAULT_PRESET, METRICS, THEMES, type ResolvedTheme } from './tokens.ts';

const HEADER =
  '/* Generated from src/tokens.ts by `pnpm --filter @bemmoly/ui tokens:css`. Do not edit. */';

function declarations(theme: ResolvedTheme): string[] {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}: ${theme.colors[token]};`),
    `--font-ui: ${theme.fontUi};`,
    `--font-code: ${theme.fontCode};`,
    `color-scheme: ${theme.mode};`,
  ];
}

function block(selector: string, lines: readonly string[]): string {
  return `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}`;
}

/** CSS variables for every preset, keyed by `data-theme` on the root element. */
export function renderThemeCss(): string {
  const metrics = Object.entries(METRICS).map(([name, value]) => `--${name}: ${value};`);
  const presets = THEMES.map((theme) => {
    const selector =
      theme.id === DEFAULT_PRESET
        ? `:root,\n[data-theme='${theme.id}']`
        : `[data-theme='${theme.id}']`;
    return block(selector, declarations(theme));
  });
  const base = [
    block(':root', metrics),
    ...presets,
    block('body', [
      'margin: 0;',
      'background: var(--bg);',
      'color: var(--tx);',
      'font-family: var(--font-ui);',
      'font-size: var(--text-base);',
    ]),
    block('*,\n::before,\n::after', ['box-sizing: border-box;']),
    block('::-webkit-scrollbar', ['width: 10px;', 'height: 10px;']),
    block('::-webkit-scrollbar-thumb', [
      'background: var(--br3);',
      'border-radius: 6px;',
      'border: 2px solid var(--bg);',
    ]),
  ];
  return `${HEADER}\n${base.join('\n\n')}\n`;
}

/** Tailwind 4 theme: utilities resolve to the runtime variables, so presets switch without a rebuild. */
export function renderTailwindCss(): string {
  const colors = COLOR_TOKENS.map((token) => `--color-${token}: var(--${token});`);
  const theme = [
    ...colors,
    '--font-sans: var(--font-ui);',
    '--font-mono: var(--font-code);',
    '--text-base: var(--text-base);',
    '--text-base--line-height: normal;',
    '--text-nav: var(--text-nav);',
    '--text-brand: var(--text-brand);',
    '--text-mono: var(--text-mono);',
    '--radius-control: var(--radius-control);',
    '--spacing-control: var(--size-control);',
    '--spacing-topbar: var(--size-topbar);',
  ];
  return [
    HEADER,
    "@source './components';",
    '',
    block('@theme', ['--color-*: initial;', '--spacing: 4px;']),
    '',
    block('@theme inline', theme),
    '',
  ].join('\n');
}
