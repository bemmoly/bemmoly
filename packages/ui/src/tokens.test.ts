import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderCssFiles, renderTailwindCss } from './css.ts';
import { channelDistance, mixCss, resolveHex } from './theme/color.ts';
import {
  accentTints,
  AI_TOKENS,
  COLOR_TOKENS,
  PRESET_IDS,
  PRESETS,
  themeById,
  THEMES,
} from './tokens.ts';

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

/** Literals the other mocks use, which Classic must equal exactly. */
const MOCK_LITERALS = {
  'ac-br2': '#d9e1f5',
  sf2: '#fafbfc',
  'br-row': '#eceef2',
  'br-ctl': '#c8ced8',
  'br-off': '#cfd4dc',
  'tx-body': '#2c3545',
  ok: '#2b9b5a',
  'ok-fg': '#1f7a44',
  'ok-bg': '#e3f4ea',
  danger: '#d93838',
  'danger-hi': '#c42d2d',
  warn: '#e0632a',
  'warn-fg': '#b4470f',
  'warn-bg': '#fdeee3',
  caution: '#d49a1a',
  'st-rev-bg': '#efe9fd',
  'st-rev-fg': '#5a3cae',
  'st-qa-bg': '#fdf3dc',
  'st-qa-fg': '#8a6210',
  'violet-bg': '#e4dcfa',
  'sky-fg': '#075985',
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

  it('Classic equals the Board mock :root variables and the other mocks literals exactly', () => {
    expect(themeById('light').colors).toMatchObject({ ...BOARD_ROOT, ...MOCK_LITERALS });
    expect(themeById('light').fontUi.startsWith("'IBM Plex Sans'")).toBe(true);
  });

  it('keeps Classic as exact hex because the Board formula does not reproduce it', () => {
    const formula = accentTints('#2456c9', 'light', '#fff');
    const exact = PRESETS[0].exact.tints;
    for (const token of Object.keys(formula) as (keyof typeof formula)[]) {
      const steps = channelDistance(formula[token], exact[token]);
      expect(steps).toBeGreaterThan(0);
      expect(steps).toBeLessThanOrEqual(17);
    }
  });

  it('derives tints for the other presets with the Board mock formula', () => {
    expect(themeById('dark').colors['ac-bg']).toBe('color-mix(in oklab, #5b8def 18%, #1a1f29)');
    expect(themeById('slate').colors['ac-bg']).toBe('color-mix(in oklab, #0f766e 9%, #fff)');
  });

  it('derives dark status and avatar pairs with the Board mock people remap', () => {
    const dark = themeById('dark').colors;
    expect(dark['st-rev-bg']).toBe(mixCss('#5a3cae', 30, '#1a1f29'));
    expect(dark['st-rev-fg']).toBe(mixCss('#5a3cae', 60, '#fff'));
    expect(dark['orange-bg']).toBe(mixCss('#9a4a16', 30, '#1a1f29'));
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

  it('reserves the AI tokens and starts them on the accent family the mocks use for AI', () => {
    expect(AI_TOKENS).toEqual(['ai', 'ai-mute', 'ai-bg', 'ai-tint', 'ai-br', 'ai-br2', 'ai-tx']);
    for (const { colors } of THEMES) {
      expect(colors.ai).toBe(colors.ac);
      expect(colors['ai-bg']).toBe(colors['ac-bg2']);
      expect(colors['ai-tint']).toBe(colors['ac-bg']);
      expect(colors['ai-br']).toBe(colors['ac-br']);
      expect(colors['ai-br2']).toBe(colors['ac-br2']);
      expect(colors['ai-mute']).toBe(colors['ac-mute']);
    }
  });

  it('gives every font stack real fallbacks', () => {
    for (const theme of THEMES) {
      expect(theme.fontUi).toMatch(/system-ui, .*sans-serif$/);
      expect(theme.fontCode).toMatch(/^'IBM Plex Mono', .*monospace$/);
    }
  });
});

describe('generated CSS', () => {
  it('every generated file is in sync with tokens.ts', () => {
    const normalise = (css: string) => css.replace(/\s+/g, ' ').trim();
    for (const [path, css] of Object.entries(renderCssFiles())) {
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

  it('stops animation and transitions under prefers-reduced-motion', () => {
    expect(renderCssFiles()['styles/base.css']).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*transition-duration: 0\.01ms !important/,
    );
  });
});
