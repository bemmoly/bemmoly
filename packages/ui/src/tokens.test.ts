import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonClassName } from './components/button.tsx';
import { renderTailwindCss, renderThemeCss } from './css.ts';
import { PRESET_IDS, themeById, THEMES } from './tokens.ts';

/** Copied verbatim from the `P` array in the Appearance Settings mock. */
const APPEARANCE_PRESETS = [
  ['light', 'Classic', 'Light', '#f4f5f7', '#fff', '#2456c9', '#d5dae2'],
  ['dark', 'Dark', 'Dark', '#0f1217', '#1a1f29', '#5b8def', '#262c38'],
  ['slate', 'Slate', 'Light', '#eef1f4', '#fff', '#0f766e', '#c8d0da'],
  ['warm', 'Warm', 'Light', '#f6f3ee', '#fffdf9', '#b4530f', '#d8d0c3'],
  ['midnight', 'Midnight', 'Dark', '#0b0a14', '#171428', '#a78bfa', '#2a2542'],
  ['forest', 'Forest', 'Light', '#f1f4f1', '#fff', '#1f7a44', '#c9d3cb'],
  ['ocean', 'Ocean', 'Dark', '#07111c', '#101e30', '#38bdf8', '#1e3047'],
  ['rose', 'Rose', 'Light', '#f7f3f4', '#fff', '#be123c', '#d9ccd1'],
] as const;

/** The :root block of the Board mock. */
const BOARD_ROOT = {
  ac: '#2456c9',
  'ac-d': '#183d94',
  'ac-l': '#6a8fe8',
  'ac-bg': '#eef3fe',
  'ac-bg2': '#f6f8fe',
  'ac-br': '#cdd8f3',
  'ac-av': '#d7e3fb',
  'ac-mute': '#7a93d9',
  bg: '#f4f5f7',
  bg2: '#f9fafb',
  sf: '#fff',
  br: '#e2e5ea',
  br2: '#e9ecf0',
  br3: '#d5dae2',
  trk: '#e5e8ee',
  chip: '#eef0f4',
  tx: '#1b2430',
  tx2: '#3b4454',
  tx3: '#4b5565',
  tx4: '#6b7483',
  tx5: '#8a93a3',
  tx6: '#a2aab8',
};

describe('design tokens', () => {
  it('has the eight presets of the Setup and Appearance mocks, in order', () => {
    expect(PRESET_IDS).toEqual(APPEARANCE_PRESETS.map(([id]) => id));
  });

  it.each(APPEARANCE_PRESETS)(
    '%s matches the mock preview swatch',
    (id, name, mode, bg, sf, ac, border) => {
      const theme = themeById(id);
      expect(theme.name).toBe(name);
      expect(theme.mode).toBe(mode.toLowerCase());
      expect(theme.colors.bg).toBe(bg);
      expect(theme.colors.sf).toBe(sf);
      expect(theme.colors.ac).toBe(ac);
      expect(theme.colors[theme.mode === 'dark' ? 'br' : 'br3']).toBe(border);
    },
  );

  it('Classic equals the Board mock :root variables exactly', () => {
    expect(themeById('light').colors).toMatchObject(BOARD_ROOT);
    expect(themeById('light').fontUi.startsWith("'IBM Plex Sans'")).toBe(true);
  });

  it('derives tints for the other presets with the Board mock formula', () => {
    expect(themeById('dark').colors['ac-bg']).toBe('color-mix(in oklab, #5b8def 18%, #1a1f29)');
    expect(themeById('slate').colors['ac-bg']).toBe('color-mix(in oklab, #0f766e 9%, #fff)');
  });

  it('gives every font stack real fallbacks', () => {
    for (const theme of THEMES) {
      expect(theme.fontUi).toMatch(/system-ui, .*sans-serif$/);
      expect(theme.fontCode).toMatch(/^'IBM Plex Mono', .*monospace$/);
    }
  });
});

describe('generated CSS', () => {
  it('theme.css and tailwind.css are in sync with tokens.ts', () => {
    const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
    const normalise = (css: string) => css.replace(/\s+/g, ' ').trim();
    expect(normalise(read('./theme.css'))).toBe(normalise(renderThemeCss()));
    expect(normalise(read('./tailwind.css'))).toBe(normalise(renderTailwindCss()));
  });

  it('declares every preset and removes the default Tailwind palette', () => {
    const css = renderThemeCss();
    for (const id of PRESET_IDS) expect(css).toContain(`[data-theme='${id}']`);
    expect(renderTailwindCss()).toContain('--color-*: initial;');
  });
});

describe('Button', () => {
  it('uses token utilities only, never literal colours', () => {
    for (const variant of ['primary', 'secondary'] as const) {
      const classes = buttonClassName(variant);
      expect(classes).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|\[/i);
    }
    expect(buttonClassName('primary')).toContain('bg-ac');
    expect(buttonClassName('secondary', 'w-full')).toContain('border-br3');
  });
});
