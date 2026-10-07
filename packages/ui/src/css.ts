import {
  COLOR_TOKENS,
  DEFAULT_PRESET,
  LEADING,
  METRICS,
  MOTION,
  RADII,
  SHADOWS,
  THEMES,
  TRACKING,
  TYPE_SCALE,
  type ResolvedTheme,
} from './tokens.ts';

const HEADER =
  '/* Generated from src/tokens.ts by `pnpm --filter @bemmoly/ui tokens:css`. Do not edit. */';

type ThemeLike = Pick<ResolvedTheme, 'colors' | 'fontUi' | 'fontCode' | 'mode'>;

/** The CSS custom properties of one theme, without selector. */
export function themeDeclarations(theme: ThemeLike): string[] {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}: ${theme.colors[token]};`),
    `--font-ui: ${theme.fontUi};`,
    `--font-code: ${theme.fontCode};`,
    `color-scheme: ${theme.mode};`,
  ];
}

function block(selector: string, lines: readonly string[], indent = ''): string {
  const body = lines.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

const vars = (prefix: string, scale: Readonly<Record<string, string>>) =>
  Object.entries(scale).map(([name, value]) => `--${prefix}${name}: ${value};`);

/** Base rules: metrics, page defaults, scrollbars and the reduced-motion override. */
export function renderBaseCss(): string {
  const reducedMotion = block(
    '*,\n  ::before,\n  ::after',
    [
      'animation-duration: 0.01ms !important;',
      'animation-iteration-count: 1 !important;',
      'transition-duration: 0.01ms !important;',
      'scroll-behavior: auto !important;',
    ],
    '  ',
  );
  const rules = [
    block(':root', [
      ...vars('', METRICS),
      ...vars('shadow-', SHADOWS),
      ...vars('duration-', MOTION),
    ]),
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
      'background: var(--br-off);',
      'border-radius: 6px;',
      'border: 2px solid var(--bg);',
    ]),
    // Components animate only behind motion-safe:; this also stops anything a page adds.
    `@media (prefers-reduced-motion: reduce) {\n${reducedMotion}\n}`,
  ];
  return `${HEADER}\n${rules.join('\n\n')}\n`;
}

/** One preset's variables, keyed by `data-theme`; Classic also owns :root. */
export function renderPresetCss(theme: ResolvedTheme): string {
  const selector =
    theme.id === DEFAULT_PRESET
      ? `:root,\n[data-theme='${theme.id}']`
      : `[data-theme='${theme.id}']`;
  return `${HEADER}\n${block(selector, themeDeclarations(theme))}\n`;
}

/** The theme.css entry point: imports the base rules and every preset. */
export function renderThemeCss(): string {
  const imports = [
    "@import './styles/base.css';",
    ...THEMES.map((theme) => `@import './styles/presets/${theme.id}.css';`),
  ];
  return `${HEADER}\n${imports.join('\n')}\n`;
}

/** Tailwind 4 theme: utilities resolve to the runtime variables, so presets switch without a rebuild. */
export function renderTailwindCss(): string {
  const colors = COLOR_TOKENS.map((token) => `--color-${token}: var(--${token});`);
  const runtimeText = ['base', 'nav', 'brand', 'mono'].flatMap((name) => [
    `--text-${name}: var(--text-${name});`,
    `--text-${name}--line-height: normal;`,
  ]);
  const theme = [
    ...colors,
    '--font-sans: var(--font-ui);',
    '--font-mono: var(--font-code);',
    ...runtimeText,
    ...Object.keys(SHADOWS).map((name) => `--shadow-${name}: var(--shadow-${name});`),
    '--radius-control: var(--radius-control);',
    '--spacing-control: var(--size-control);',
    '--spacing-topbar: var(--size-topbar);',
    '--default-transition-duration: var(--duration-fast);',
  ];
  const text = Object.entries(TYPE_SCALE).flatMap(([name, size]) => [
    `--text-${name}: ${size};`,
    `--text-${name}--line-height: normal;`,
  ]);
  const statics = [
    '--color-*: initial;',
    '--font-*: initial;',
    '--text-*: initial;',
    '--radius-*: initial;',
    '--shadow-*: initial;',
    '--leading-*: initial;',
    '--tracking-*: initial;',
    '--spacing: 4px;',
    ...text,
    ...vars('radius-', RADII).filter((line) => !line.startsWith('--radius-control')),
    ...vars('leading-', LEADING),
    ...vars('tracking-', TRACKING),
  ];
  return [
    HEADER,
    "@source './components';",
    "@source './icons';",
    '',
    block('@theme', statics),
    '',
    block('@theme inline', theme),
    '',
  ].join('\n');
}

/** Every generated file, keyed by path relative to src/. */
export function renderCssFiles(): Record<string, string> {
  return {
    'theme.css': renderThemeCss(),
    'tailwind.css': renderTailwindCss(),
    'styles/base.css': renderBaseCss(),
    ...Object.fromEntries(
      THEMES.map((theme) => [`styles/presets/${theme.id}.css`, renderPresetCss(theme)]),
    ),
  };
}
