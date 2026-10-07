import { describe, expect, it } from 'vitest';
import { CLASSIC_NEUTRALS, DARK_NEUTRALS, PRESETS, themeById } from '../tokens.ts';
import {
  applyTheme,
  buildTheme,
  clearTheme,
  contrastCheck,
  toHexColors,
  whiteContrast,
} from './index.ts';
import { channelDistance, mixCss } from './color.ts';

/** The Appearance Settings mock's own code (formatted, types added) as the oracle for the port. */
/* eslint-disable */
const mock = (brand: string) => {
  const s = { brand };
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return 0.5;
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio: any = (1.05 / (lum(s.brand) + 0.05)).toFixed(1);
  return ratio >= 4.5
    ? `White text on ${s.brand} is ${ratio}:1. Passes for buttons and labels.`
    : ratio >= 3
      ? `White text on ${s.brand} is ${ratio}:1. We'll darken it for button text so it stays readable.`
      : `${s.brand} is too light for white text (${ratio}:1). We'll use dark text on buttons and a darker shade for links.`;
};
/* eslint-enable */

const SWATCHES = ['#f97316', '#e11d48', '#7c3aed', '#2456c9', '#0f766e', '#111827'];

describe('contrast check', () => {
  it('produces the mock message for its swatches and for 2,000 random colours', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0xffffff;
    const colours = [
      ...SWATCHES,
      ...Array.from(
        { length: 2000 },
        () => `#${Math.floor(random()).toString(16).padStart(6, '0')}`,
      ),
    ];
    for (const brand of colours) expect(contrastCheck(brand).message).toBe(mock(brand));
  });

  it('classifies the three outcomes', () => {
    expect(contrastCheck('#2456c9')).toMatchObject({ level: 'pass', ratio: '6.5' });
    expect(contrastCheck('#e11d48').level).toBe('pass');
    expect(contrastCheck('#f97316')).toMatchObject({ level: 'dark-text', ratio: '2.8' });
    expect(contrastCheck('#e0632a').level).toBe('darken');
  });
});

describe('buildTheme', () => {
  it('reproduces Classic neutrals and the Board formula for a blue brand', () => {
    const t = buildTheme({ brand: '#2456c9', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.colors).toMatchObject(CLASSIC_NEUTRALS);
    expect(t.colors.ac).toBe('#2456c9');
    expect(t.colors['ac-fill']).toBe('#2456c9');
    expect(t.colors['on-ac']).toBe('#fff');
    expect(t.colors['ac-d']).toBe('color-mix(in oklab, #2456c9 75%, #000)');
    expect(t.colors['ac-l']).toBe('color-mix(in oklab, #2456c9 55%, #fff)');
    expect(t.colors.sf2).toBe(themeById('light').colors.sf2);
    expect(
      channelDistance(t.colors['ac-bg'], themeById('light').colors['ac-bg']),
    ).toBeLessThanOrEqual(4);
  });

  it('tints light surfaces toward the brand like the Board mock custom theme', () => {
    const t = buildTheme({ brand: '#f97316', mode: 'light', surfaces: 'tinted', font: 'inter' });
    expect(t.colors.bg).toBe(mixCss('#f97316', 5, '#f4f5f7'));
    expect(t.colors.bg2).toBe(mixCss('#f97316', 3, '#f4f5f7'));
    expect(t.colors.sf).toBe('#fff');
    expect(t.fontUi.startsWith("'Inter Tight'")).toBe(true);
  });

  it('builds dark variants, tinted or neutral', () => {
    const neutral = buildTheme({
      brand: '#5b8def',
      mode: 'dark',
      surfaces: 'neutral',
      font: 'plex',
    });
    expect(neutral.colors).toMatchObject(DARK_NEUTRALS);
    expect(neutral.colors['ac-bg']).toBe(themeById('dark').colors['ac-bg']);
    const tinted = buildTheme({
      brand: '#7c3aed',
      mode: 'dark',
      surfaces: 'tinted',
      font: 'geist',
    });
    expect(tinted.colors.bg).toBe(mixCss('#7c3aed', 6, '#0f1217'));
    expect(tinted.colors.bg2).toBe(mixCss('#7c3aed', 8, '#0f1217'));
    expect(tinted.colors.sf).toBe(mixCss('#7c3aed', 10, '#0f1217'));
    expect(tinted.colors['ac-bg']).toBe(mixCss('#7c3aed', 18, tinted.colors.sf));
    expect(tinted.mode).toBe('dark');
  });

  it('darkens the button fill when white text is between 3 and 4.5 to 1', () => {
    const t = buildTheme({ brand: '#e0632a', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.contrast.level).toBe('darken');
    expect(t.colors.ac).toBe('#e0632a');
    expect(t.colors['ac-fill']).not.toBe('#e0632a');
    expect(Number(whiteContrast(t.colors['ac-fill']))).toBeGreaterThanOrEqual(4.5);
    expect(t.colors['on-ac']).toBe('#fff');
  });

  it('uses dark button text and a darker link shade for light brands', () => {
    const t = buildTheme({ brand: '#f97316', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.contrast.level).toBe('dark-text');
    expect(t.colors['ac-fill']).toBe('#f97316');
    expect(t.colors['on-ac']).toBe(CLASSIC_NEUTRALS.tx);
    expect(Number(whiteContrast(t.colors.ac))).toBeGreaterThanOrEqual(4.5);
    expect(t.colors.ai).toBe(t.colors.ac);
  });

  it('rejects anything that is not six hex digits, like the mock hex field', () => {
    expect(() =>
      buildTheme({ brand: 'orange', mode: 'light', surfaces: 'neutral', font: 'plex' }),
    ).toThrow(/six hex digits/);
  });

  // Presets carry hand-tuned neutral scales the builder does not generate, so what is
  // reproducible is the accent family: identical for light presets and Dark, and for
  // Midnight and Ocean identical up to the surface the tints are mixed over.
  it.each(PRESETS.slice(1).map((p) => [p.id, p] as const))(
    'reproduces the %s preset accent tints from its accent',
    (_id, preset) => {
      const input = {
        brand: preset.accent[0],
        mode: preset.mode,
        surfaces: 'neutral',
        font: preset.font,
      } as const;
      const t = buildTheme(input);
      const colors = themeById(preset.id).colors;
      const sameSurface = preset.mode === 'light' || preset.id === 'dark';
      if (preset.id === 'dark') expect(t.colors).toMatchObject(DARK_NEUTRALS);
      for (const token of ['ac-bg', 'ac-bg2', 'ac-br', 'ac-av', 'ac-mute'] as const) {
        const expected = sameSurface
          ? colors[token]
          : colors[token].replace(preset.neutrals.sf, DARK_NEUTRALS.sf);
        expect(t.colors[token]).toBe(expected);
      }
      expect(t.fontUi).toBe(themeById(preset.id).fontUi);
    },
  );

  it('resolves every built colour to hex for email templates', () => {
    const t = buildTheme({ brand: '#0f766e', mode: 'dark', surfaces: 'tinted', font: 'source' });
    for (const [token, value] of Object.entries(toHexColors(t.colors))) {
      if (token !== 'scrim') expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('applyTheme', () => {
  it('sets every token as an inline custom property and can clear them', () => {
    const el = document.createElement('div');
    const t = buildTheme({ brand: '#7c3aed', mode: 'light', surfaces: 'neutral', font: 'geist' });
    applyTheme(el, t);
    expect(el.style.getPropertyValue('--ac')).toBe('#7c3aed');
    expect(el.style.getPropertyValue('--ai')).toBe('#7c3aed');
    expect(el.style.getPropertyValue('--font-ui')).toContain('Geist');
    expect(el.dataset['theme']).toBe('custom');
    clearTheme(el, 'light');
    expect(el.style.getPropertyValue('--ac')).toBe('');
    expect(el.dataset['theme']).toBe('light');
  });
});
