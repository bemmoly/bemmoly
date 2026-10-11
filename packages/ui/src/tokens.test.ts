import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formattedCssFiles } from '../scripts/format-css.ts';
import { renderCssFiles, renderTailwindCss } from './css.ts';
import { flatten as over, resolveHex } from './theme/color.ts';
import { contrastRatio } from './theme/contrast.ts';
import { RESERVED_HUES, reservedHue, themeChecks } from './theme/checks.ts';
import {
  BRAND,
  COLOR_TOKENS,
  ELEVATIONS,
  FIXED_COLOR_TOKENS,
  MODE_TYPE_COLORS,
  RADII,
  RADIUS_STEPS,
  RESOLVED_THEMES,
  RETIRED_PRESETS,
  resolveTheme,
  THEME_IDS,
  THEME_SOURCES,
  THEME_TOKENS,
  TYPE_COLORS,
  TYPE_SCALE,
  TYPE_STEPS,
} from './tokens.ts';

const surfacesOf = (c: Record<string, string>) => [c.canvas, c.side, c.sunken, c.card] as string[];
const PAIRS = THEME_SOURCES.flatMap((source) =>
  (['light', 'dark'] as const).map((mode) => [`${source.id} ${mode}`, source, mode] as const),
);

describe('themes', () => {
  it('ships five themes, Bemmoly first', () => {
    expect(THEME_IDS).toEqual(['bemmoly', 'graphite', 'sand', 'pine', 'contrast']);
  });

  it('makes every theme a pair: a designed light and dark set of the fifteen tokens', () => {
    expect(THEME_TOKENS).toHaveLength(15);
    for (const source of THEME_SOURCES)
      for (const mode of ['light', 'dark'] as const)
        expect(Object.keys(source[mode]).sort(), `${source.id} ${mode}`).toEqual(
          [...THEME_TOKENS].sort(),
        );
  });

  it.each(PAIRS)('%s passes all fourteen checks', (_, source, mode) => {
    const checks = themeChecks(source[mode], mode, 'highContrast' in source);
    expect(checks).toHaveLength(14);
    for (const check of checks)
      expect(check.ratio, `${check.label} (${check.pair})`).toBeGreaterThanOrEqual(check.min);
  });

  it('keeps every accent and primary fill out of the reserved hue bands', () => {
    for (const source of THEME_SOURCES)
      for (const mode of ['light', 'dark'] as const)
        for (const token of ['acc', 'acc-fill'] as const)
          expect(reservedHue(source[mode][token]), `${source.id} ${mode} ${token}`).toBeNull();
  });

  it('flags a colour in each reserved band and clears blues, teals and greys', () => {
    expect(RESERVED_HUES).toHaveLength(4);
    for (const hex of ['#e11d48', '#f97316', '#1f9d55', '#7c3aed'])
      expect(reservedHue(hex), hex).not.toBeNull();
    for (const hex of ['#2356c9', '#0f766e', '#17675a', '#111827'])
      expect(reservedHue(hex), hex).toBeNull();
  });

  it('gives Bemmoly light the design review values, with the logo blue as the accent', () => {
    const light = resolveTheme('bemmoly', 'light');
    expect(light.colors.acc).toBe(BRAND['brand-1']);
    expect(light.colors['acc-fill']).toBe(BRAND['brand-1']);
    expect(light.colors.canvas).toBe('#ffffff');
    expect(light.elevation).toEqual(ELEVATIONS.light);
    expect(resolveTheme('bemmoly', 'dark').elevation).toEqual(ELEVATIONS.dark);
  });

  it('maps every retired preset to a theme in its old mode', () => {
    expect(RETIRED_PRESETS).toMatchObject({
      classic: { theme: 'bemmoly', mode: 'light' },
      dark: { theme: 'bemmoly', mode: 'dark' },
      slate: { theme: 'graphite', mode: 'light', font: 'inter' },
      warm: { theme: 'sand', mode: 'light', font: 'source' },
      midnight: { theme: 'bemmoly', mode: 'dark', font: 'geist' },
      forest: { theme: 'pine', mode: 'light' },
      ocean: { theme: 'bemmoly', mode: 'dark', font: 'inter' },
      rose: { theme: 'bemmoly', mode: 'light', font: 'source' },
    });
  });

  it('lifts the Task and Epic tiles in dark mode only', () => {
    expect(MODE_TYPE_COLORS.light['type-task']).toBe(TYPE_COLORS['type-task']);
    expect(MODE_TYPE_COLORS.dark['type-task']).toBe(BRAND['brand-2']);
    expect(MODE_TYPE_COLORS.dark['type-epic']).not.toBe(TYPE_COLORS['type-epic']);
  });
});

describe('design tokens', () => {
  it.each(RESOLVED_THEMES.map((t) => [`${t.id} ${t.mode}`, t] as const))(
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

  it.each(RESOLVED_THEMES.map((t) => [`${t.id} ${t.mode}`, t] as const))(
    '%s: tx-2, the quiet text inside an AI card, reads at 4.5:1 on its ai-50 fill',
    (_, theme) => {
      const c = theme.colors as Record<string, string>;
      const fill = over(c['ai-50'] as string, c.card as string);
      expect(contrastRatio(c['tx-2'] as string, fill)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(RESOLVED_THEMES.map((t) => [`${t.id} ${t.mode}`, t] as const))(
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
    for (const { colors } of RESOLVED_THEMES) {
      expect(colors.ai).toBe(BRAND['brand-3']);
      expect(colors.ai).not.toBe(colors.acc);
    }
  });

  it('drops the old violet', () => {
    expect(COLOR_TOKENS).not.toContain('violet');
    expect(Object.values(renderCssFiles()).join('\n')).not.toMatch(/--violet:/);
  });

  it('defines every colour token in every theme and mode, each resolvable to a colour', () => {
    for (const theme of RESOLVED_THEMES) {
      for (const token of COLOR_TOKENS) {
        const value = theme.colors[token];
        expect(value, `${theme.id} ${token}`).toBeTruthy();
        if (!value.startsWith('rgba(')) expect(resolveHex(value)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('keeps the typeface out of every theme block', () => {
    const files = renderCssFiles();
    for (const id of THEME_IDS) expect(files[`styles/themes/${id}.css`]).not.toContain('--font-');
    expect(files['styles/fonts.css']).toMatch(/\[data-font='geist'\] \{\s*--font-ui: 'Geist'/);
    expect(files['styles/base.css']).toMatch(/--font-code: 'IBM Plex Mono', .*monospace;/);
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

  it('declares every theme in light, dark and system, and removes the Tailwind palette', () => {
    const files = renderCssFiles();
    for (const id of THEME_IDS) {
      const css = files[`styles/themes/${id}.css`] as string;
      expect(css).toContain(`[data-theme='${id}'][data-mode='dark']`);
      expect(css).toMatch(
        new RegExp(
          `prefers-color-scheme: dark[\\s\\S]*\\[data-theme='${id}'\\]\\[data-mode='system'\\]`,
        ),
      );
    }
    for (const reset of ['--color-*', '--text-*', '--radius-*', '--shadow-*']) {
      expect(renderTailwindCss()).toContain(`${reset}: initial;`);
    }
  });

  it('declares the fixed families once, on :root, so no theme can recolour them', () => {
    const files = renderCssFiles();
    const perMode = Object.keys(MODE_TYPE_COLORS.dark);
    for (const token of FIXED_COLOR_TOKENS) {
      expect(files['styles/base.css']).toContain(`--${token}:`);
      if (perMode.includes(token)) continue;
      for (const id of THEME_IDS)
        expect(files[`styles/themes/${id}.css`]).not.toContain(`--${token}:`);
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
