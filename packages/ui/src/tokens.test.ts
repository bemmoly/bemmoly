import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formattedCssFiles } from '../scripts/format-css.ts';
import { renderCssFiles, renderTailwindCss } from './css.ts';
import { flatten as over, resolveHex } from './theme/color.ts';
import { contrastRatio } from './theme/contrast.ts';
import {
  BRAND,
  COLOR_TOKENS,
  ELEVATIONS,
  FIXED_COLOR_TOKENS,
  PRESET_IDS,
  RADII,
  RADIUS_STEPS,
  themeById,
  THEMES,
  TYPE_COLORS,
  TYPE_SCALE,
  TYPE_STEPS,
} from './tokens.ts';

/** kit.css `.px`; tx-3 and todo are the two values lifted to pass contrast. */
const KIT_LIGHT = {
  canvas: '#ffffff',
  side: '#f7f8fa',
  sunken: '#f5f6f8',
  card: '#ffffff',
  hover: 'rgba(22,27,38,0.045)',
  press: 'rgba(22,27,38,0.07)',
  line: '#e7e9ee',
  'line-2': '#f0f1f4',
  tx: '#161b26',
  'tx-2': '#4b5264',
  'tx-3': '#697181',
  acc: '#2356c9',
  'acc-fill': '#2356c9',
  'acc-500': '#5b7be5',
  'acc-50': '#eef2fd',
  'acc-100': '#dfe7fb',
  'on-acc': '#fff',
  ai: '#9a85ea',
  'ai-50': '#f4f1fd',
  todo: '#888f9c',
  prog: '#2356c9',
  done: '#1f9d55',
  red: '#e5484d',
  'red-50': '#fdeeee',
  amber: '#d97706',
  'amber-50': '#fff6e6',
};

/** kit.css `.px.dark`; tx-3 is lifted, and the accent is split into text and fill. */
const KIT_DARK = {
  canvas: '#111418',
  side: '#0c0f13',
  sunken: '#0e1115',
  card: '#181c22',
  hover: 'rgba(255,255,255,.05)',
  press: 'rgba(255,255,255,.08)',
  line: 'rgba(255,255,255,.08)',
  'line-2': 'rgba(255,255,255,.05)',
  tx: '#e8ebf1',
  'tx-2': '#a8b0be',
  'tx-3': '#7d8492',
  'acc-500': '#7b95ec',
  'acc-50': 'rgba(91,123,229,.14)',
  'acc-100': 'rgba(91,123,229,.24)',
  todo: '#6f7786',
  prog: '#6f8ff0',
  done: '#3fb67a',
  'amber-50': 'rgba(217,119,6,.14)',
  'red-50': 'rgba(229,72,77,.14)',
};

const surfacesOf = (c: Record<string, string>) => [c.canvas, c.side, c.sunken, c.card] as string[];

describe('design tokens', () => {
  it('keeps the eight presets in order', () => {
    expect(PRESET_IDS).toEqual([
      'light',
      'dark',
      'slate',
      'warm',
      'midnight',
      'forest',
      'ocean',
      'rose',
    ]);
  });

  it('gives Classic the design review values, with the logo blue as the accent', () => {
    expect(themeById('light').colors).toMatchObject(KIT_LIGHT);
    expect(themeById('light').colors.acc).toBe(BRAND['brand-1']);
    expect(themeById('light').elevation).toMatchObject(ELEVATIONS.light);
  });

  it('gives Dark the review dark values, its accent from the logo mid blue', () => {
    const dark = themeById('dark').colors;
    expect(dark).toMatchObject(KIT_DARK);
    expect(dark['acc-500']).not.toBe(BRAND['brand-2']);
    expect(dark['acc-fill']).toBe('#506ecf');
    expect(themeById('dark').elevation.e2).toBe(ELEVATIONS.dark.e2);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))(
    '%s: text greys pass 4.5:1 on every surface',
    (_, theme) => {
      const c = theme.colors as Record<string, string>;
      for (const surface of surfacesOf(c))
        for (const ink of ['tx', 'tx-2', 'tx-3', 'acc'])
          expect(
            contrastRatio(c[ink] as string, surface),
            `${ink} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(THEMES.map((t) => [t.id, t] as const))(
    '%s: accent fills, glyphs and signals hold contrast',
    (_, theme) => {
      const c = theme.colors as Record<string, string>;
      const card = c.card as string;
      expect(contrastRatio(c['on-acc'] as string, c['acc-fill'] as string)).toBeGreaterThanOrEqual(
        4.5,
      );
      for (const glyph of ['todo', 'prog', 'done'])
        expect(contrastRatio(c[glyph] as string, card), glyph).toBeGreaterThanOrEqual(3);
      for (const signal of ['red', 'amber', 'green']) {
        const ink = c[`${signal}-tx`] as string;
        expect(contrastRatio(ink, card), signal).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(ink, over(c[`${signal}-50`] as string, card)),
          signal,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrastRatio(c['ai-600'] as string, over(c['ai-50'] as string, card)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('emits no first-release alias, so every screen uses the canonical names', () => {
    const css = Object.values(renderCssFiles()).join('\n');
    for (const old of ['--sf:', '--tx4:', '--ac-bg:', '--br2:', '--shadow-card:', '--text-12h:'])
      expect(css).not.toContain(old);
  });

  it('keeps AI on the logo lilac, apart from the accent', () => {
    for (const { colors } of THEMES) {
      expect(colors.ai).toBe(BRAND['brand-3']);
      expect(colors.ai).not.toBe(colors.acc);
    }
  });

  it('drops the old violet', () => {
    expect(COLOR_TOKENS).not.toContain('violet');
    expect(Object.values(renderCssFiles()).join('\n')).not.toMatch(/--violet:/);
  });

  it('defines every colour token in every preset, each resolvable to a colour', () => {
    for (const theme of THEMES) {
      for (const token of COLOR_TOKENS) {
        const value = theme.colors[token];
        expect(value, `${theme.id} ${token}`).toBeTruthy();
        if (!value.startsWith('rgba(')) expect(resolveHex(value)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('gives every font stack real fallbacks', () => {
    for (const theme of THEMES) {
      expect(theme.fontUi).toMatch(/system-ui, .*sans-serif$/);
      expect(theme.fontCode).toMatch(/^'IBM Plex Mono', .*monospace$/);
    }
  });

  it('keeps the type and radius scales to the diet, with old names on a step', () => {
    expect(Object.keys(TYPE_STEPS)).toEqual(['11', '12', '13', '14', '16', '20', '24']);
    expect(new Set(Object.values(TYPE_SCALE))).toEqual(new Set(Object.values(TYPE_STEPS)));
    expect(Object.values(RADIUS_STEPS)).toEqual(['2px', '4px', '6px', '8px', '12px', '9999px']);
    expect(new Set(Object.values(RADII))).toEqual(new Set(Object.values(RADIUS_STEPS)));
  });
});

describe('generated CSS', () => {
  it('every generated file is in sync with tokens.ts', async () => {
    const normalise = (css: string) => css.replace(/\s+/g, ' ').trim();
    for (const [path, css] of Object.entries(await formattedCssFiles())) {
      const onDisk = readFileSync(join(dirname(fileURLToPath(import.meta.url)), path), 'utf8');
      expect(normalise(onDisk), path).toBe(normalise(css));
    }
  });

  it('declares every preset and removes the default Tailwind palette and scales', () => {
    const files = renderCssFiles();
    for (const id of PRESET_IDS)
      expect(files[`styles/presets/${id}.css`]).toContain(`[data-theme='${id}']`);
    for (const reset of ['--color-*', '--text-*', '--radius-*', '--shadow-*']) {
      expect(renderTailwindCss()).toContain(`${reset}: initial;`);
    }
  });

  it('declares the fixed families once, on :root, so no preset can recolour them', () => {
    const files = renderCssFiles();
    for (const token of FIXED_COLOR_TOKENS) {
      expect(files['styles/base.css']).toContain(`--${token}:`);
      for (const id of PRESET_IDS)
        expect(files[`styles/presets/${id}.css`]).not.toContain(`--${token}:`);
    }
    expect(files['styles/base.css']).toContain(`--type-epic: ${TYPE_COLORS['type-epic']}`);
  });

  it('stops animation and zeroes durations under prefers-reduced-motion', () => {
    const base = renderCssFiles()['styles/base.css'];
    expect(base).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*transition-duration: 0\.01ms !important/,
    );
    expect(base).toMatch(/prefers-reduced-motion: reduce[\s\S]*--duration-base: 0ms/);
  });

  it('ships the focus ring as a utility on :focus-visible', () => {
    expect(renderTailwindCss()).toMatch(
      /@utility focus-ring \{\s*&:focus-visible \{\s*outline: var\(--focus-width\) solid var\(--acc\)/,
    );
  });
});
