import {
  ANIMATIONS,
  COLOR_TOKENS,
  DEFAULT_THEME,
  EASE,
  ELEVATION_TOKENS,
  FIXED_COLORS,
  FOCUS,
  FONT_IDS,
  FONTS,
  KEYFRAMES,
  LEADING,
  METRICS,
  MODE_TYPE_COLORS,
  MONO_STACK,
  MOTION,
  RADII,
  resolveSource,
  SHADOWS,
  THEME_SOURCES,
  TRACKING,
  TYPE_SCALE,
  type ResolvedTheme,
  type ThemeSource,
} from './tokens.ts';

const HEADER =
  '/* Generated from src/tokens.ts by `pnpm --filter @bemmoly/ui tokens:css`. Do not edit. */';

type ThemeLike = Pick<ResolvedTheme, 'colors' | 'elevation' | 'mode'>;

/** The CSS custom properties of one theme in one mode, without selector. */
export function themeDeclarations(theme: ThemeLike): string[] {
  return [
    ...COLOR_TOKENS.map((token) => `--${token}: ${theme.colors[token]};`),
    ...Object.entries(MODE_TYPE_COLORS[theme.mode]).map(
      ([token, value]) => `--${token}: ${value};`,
    ),
    ...ELEVATION_TOKENS.map((token) => `--${token}: ${theme.elevation[token]};`),
    `color-scheme: ${theme.mode};`,
  ];
}

function block(selector: string, lines: readonly string[], indent = ''): string {
  const body = lines.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

const vars = (prefix: string, scale: Readonly<Record<string, string>>) =>
  Object.entries(scale).map(([name, value]) => `--${prefix}${name}: ${value};`);

/** Base rules: metrics, fixed colours, page defaults, scrollbars and the reduced-motion override. */
export function renderBaseCss(): string {
  const reducedMotion = [
    block('*,\n  ::before,\n  ::after', [
      'animation-duration: 0.01ms !important;',
      'animation-iteration-count: 1 !important;',
      'transition-duration: 0.01ms !important;',
      'scroll-behavior: auto !important;',
    ]),
    block(
      ':root',
      Object.keys(MOTION).map((name) => `--duration-${name}: 0ms;`),
    ),
  ]
    .map((rule) => rule.replace(/^/gm, '  '))
    .join('\n\n');
  const rules = [
    block(':root', [
      ...vars('', METRICS),
      ...vars('', FIXED_COLORS),
      `--font-code: ${MONO_STACK};`,
      ...vars('', FOCUS),
      ...vars('shadow-', SHADOWS),
      ...vars('duration-', MOTION),
      ...vars('ease-', EASE),
    ]),
    block('body', [
      'margin: 0;',
      'background: var(--sunken);',
      'color: var(--tx);',
      'font-family: var(--font-ui);',
      'font-size: var(--text-base);',
      // The mocks use the browser's normal line height; Tailwind's preflight would set 1.5.
      'line-height: normal;',
    ]),
    block('*,\n::before,\n::after', ['box-sizing: border-box;']),
    block('::-webkit-scrollbar', ['width: 10px;', 'height: 10px;']),
    // A transparent border clipped out of the background keeps a 2px gap around the thumb on
    // every surface.
    block('::-webkit-scrollbar-thumb', [
      'background: var(--line);',
      'background-clip: padding-box;',
      'border-radius: 6px;',
      'border: 2px solid transparent;',
    ]),
    block('::-webkit-scrollbar-thumb:hover', ['background-color: var(--tx-3);']),
    block('::-webkit-scrollbar-corner', ['background: transparent;']),
    // Components animate only behind motion-safe:; this also stops anything a page adds, and
    // zeroes the durations code waits on.
    `@media (prefers-reduced-motion: reduce) {\n${reducedMotion}\n}`,
  ];
  return `${HEADER}\n${rules.join('\n\n')}\n`;
}

/**
 * One theme in both modes, keyed by `data-theme` and `data-mode` (ADR 0021). Light is the
 * theme's plain selector; `data-mode='dark'` takes the dark set, and `data-mode='system'`
 * takes it only while the device prefers dark, so first paint follows the OS with no script.
 * Bemmoly also owns :root, in either mode.
 */
export function renderThemeBlockCss(source: ThemeSource): string {
  const own = `[data-theme='${source.id}']`;
  const isDefault = source.id === DEFAULT_THEME;
  const light = isDefault ? `:root,\n${own}` : own;
  const dark = isDefault
    ? `:root:not([data-theme])[data-mode='dark'],\n${own}[data-mode='dark']`
    : `${own}[data-mode='dark']`;
  const system = isDefault
    ? `:root:not([data-theme])[data-mode='system'],\n  ${own}[data-mode='system']`
    : `${own}[data-mode='system']`;
  const darkLines = themeDeclarations(resolveSource(source, 'dark'));
  return [
    HEADER,
    block(light, themeDeclarations(resolveSource(source, 'light'))),
    '',
    block(dark, darkLines),
    '',
    `@media (prefers-color-scheme: dark) {\n${block(system, darkLines, '  ')}\n}`,
    '',
  ].join('\n');
}

/** The typeface is its own setting: `data-font` on the root picks one; Plex owns :root. */
export function renderFontsCss(): string {
  const rules = FONT_IDS.map((id) =>
    block(id === 'plex' ? `:root,\n[data-font='${id}']` : `[data-font='${id}']`, [
      `--font-ui: ${FONTS[id].stack};`,
    ]),
  );
  return `${HEADER}\n${rules.join('\n\n')}\n`;
}

/** The theme.css entry point: imports the base rules, the typefaces and every theme. */
export function renderThemeCss(): string {
  const imports = [
    "@import './styles/base.css';",
    "@import './styles/fonts.css';",
    ...THEME_SOURCES.map((theme) => `@import './styles/themes/${theme.id}.css';`),
  ];
  return `${HEADER}\n${imports.join('\n')}\n`;
}

/**
 * The focus ring and the hover and press fills as utilities, so every interactive primitive
 * draws them the same way.
 */
const UTILITIES = [
  block('@utility focus-ring', [
    '&:focus-visible {',
    '  outline: var(--focus-width) solid var(--acc);',
    '  outline-offset: var(--focus-offset);',
    '}',
  ]),
  block('@utility focus-ring-within', [
    '&:has(:focus-visible) {',
    '  outline: var(--focus-width) solid var(--acc);',
    '  outline-offset: var(--focus-offset);',
    '}',
  ]),
  block('@utility focus-ring-inset', [
    '&:focus-visible {',
    '  outline: var(--focus-width) solid var(--acc);',
    '  outline-offset: calc(var(--focus-width) * -1);',
    '}',
  ]),
];

/** Tailwind 4 theme: utilities resolve to the runtime variables, so themes switch without a rebuild. */
export function renderTailwindCss(): string {
  const colors = [...COLOR_TOKENS, ...Object.keys(FIXED_COLORS)].map(
    (token) => `--color-${token}: var(--${token});`,
  );
  const runtimeText = ['base', 'nav', 'brand', 'mono'].flatMap((name) => [
    `--text-${name}: var(--text-${name});`,
    `--text-${name}--line-height: normal;`,
  ]);
  const shadows = [
    ...ELEVATION_TOKENS.map((token) => token.replace(/^shadow-/, '')),
    ...Object.keys(SHADOWS),
  ].map((name) => `--shadow-${name}: var(--${/^e\dh?$/.test(name) ? name : `shadow-${name}`});`);
  const theme = [
    ...colors,
    '--font-sans: var(--font-ui);',
    '--font-mono: var(--font-code);',
    ...runtimeText,
    ...shadows,
    '--radius-control: var(--radius-control);',
    '--spacing-control: var(--size-control);',
    '--spacing-topbar: var(--size-topbar);',
    '--default-transition-duration: var(--duration-fast);',
    ...Object.keys(EASE).map((name) => `--ease-${name}: var(--ease-${name});`),
    '--default-transition-timing-function: var(--ease-standard);',
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
    ...vars('animate-', ANIMATIONS),
  ];
  const keyframes = Object.entries(KEYFRAMES).map(([name, stops]) =>
    block(
      `@keyframes ${name}`,
      Object.entries(stops).map(([stop, css]) => `${stop} { ${css} }`),
      '  ',
    ),
  );
  return [
    HEADER,
    "@source './components';",
    "@source './icons';",
    '',
    block('@theme', statics).replace(/\n}$/, `\n\n${keyframes.join('\n\n')}\n}`),
    '',
    block('@theme inline', theme),
    '',
    UTILITIES.join('\n\n'),
    '',
  ].join('\n');
}

/** Every generated file, keyed by path relative to src/. */
export function renderCssFiles(): Record<string, string> {
  return {
    'theme.css': renderThemeCss(),
    'tailwind.css': renderTailwindCss(),
    'styles/base.css': renderBaseCss(),
    'styles/fonts.css': renderFontsCss(),
    ...Object.fromEntries(
      THEME_SOURCES.map((theme) => [`styles/themes/${theme.id}.css`, renderThemeBlockCss(theme)]),
    ),
  };
}
