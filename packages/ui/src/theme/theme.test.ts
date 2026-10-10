import { describe, expect, it } from 'vitest';
import { CLASSIC_NEUTRALS, DARK_NEUTRALS, PRESETS, themeById } from '../tokens.ts';
import {
  applyTheme,
  buildTheme,
  clearTheme,
  contrastCheck,
  contrastRatio,
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
  it('reproduces Classic for the logo blue', () => {
    const t = buildTheme({ brand: '#2356c9', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.colors).toMatchObject(CLASSIC_NEUTRALS);
    expect(t.colors.acc).toBe('#2356c9');
    expect(t.colors['acc-fill']).toBe('#2356c9');
    expect(t.colors['on-acc']).toBe('#fff');
    expect(t.colors['acc-600']).toBe('color-mix(in oklab, #2356c9 75%, #000)');
    expect(t.colors['acc-500']).toBe('color-mix(in oklab, #2356c9 55%, #fff)');
    expect(
      channelDistance(t.colors['acc-50'], themeById('light').colors['acc-50']),
    ).toBeLessThanOrEqual(4);
    expect(t.elevation).toEqual(themeById('light').elevation);
  });

  it('tints light surfaces toward the brand', () => {
    const t = buildTheme({ brand: '#f97316', mode: 'light', surfaces: 'tinted', font: 'inter' });
    expect(t.colors.sunken).toBe(mixCss('#f97316', 5, CLASSIC_NEUTRALS.sunken));
    expect(t.colors.side).toBe(mixCss('#f97316', 3, CLASSIC_NEUTRALS.side));
    expect(t.colors.card).toBe('#ffffff');
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
    const tinted = buildTheme({
      brand: '#7c3aed',
      mode: 'dark',
      surfaces: 'tinted',
      font: 'geist',
    });
    expect(tinted.colors.sunken).toBe(mixCss('#7c3aed', 6, DARK_NEUTRALS.sunken));
    expect(tinted.colors.card).toBe(mixCss('#7c3aed', 10, DARK_NEUTRALS.card));
    expect(tinted.colors['acc-50']).toBe(mixCss('#7c3aed', 16, tinted.colors.card));
    expect(tinted.mode).toBe('dark');
    expect(tinted.elevation).toEqual(themeById('dark').elevation);
  });

  it('darkens the button fill when white text is between 3 and 4.5 to 1', () => {
    const t = buildTheme({ brand: '#e0632a', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.contrast.level).toBe('darken');
    expect(t.colors['acc-fill']).not.toBe('#e0632a');
    expect(Number(whiteContrast(t.colors['acc-fill']))).toBeGreaterThanOrEqual(4.5);
    expect(t.colors['on-acc']).toBe('#fff');
  });

  it('uses dark button text and a darker link shade for light brands', () => {
    const t = buildTheme({ brand: '#f97316', mode: 'light', surfaces: 'neutral', font: 'plex' });
    expect(t.contrast.level).toBe('dark-text');
    expect(t.colors['acc-fill']).toBe('#f97316');
    expect(t.colors['on-acc']).toBe(CLASSIC_NEUTRALS.tx);
    expect(Number(whiteContrast(t.colors.acc))).toBeGreaterThanOrEqual(4.5);
    expect(t.colors.ai).toBe('#9a85ea');
  });

  it('rejects anything that is not six hex digits, like the mock hex field', () => {
    expect(() =>
      buildTheme({ brand: 'orange', mode: 'light', surfaces: 'neutral', font: 'plex' }),
    ).toThrow(/six hex digits/);
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))(
    'builds a theme from the %s accent whose text passes on its surfaces',
    (_id, preset) => {
      const input = {
        brand: preset.accent[0],
        mode: preset.mode,
        surfaces: 'tinted',
        font: preset.font,
      } as const;
      const t = buildTheme(input);
      for (const surface of [t.colors.canvas, t.colors.side, t.colors.sunken, t.colors.card])
        for (const ink of [t.colors.tx, t.colors['tx-2'], t.colors['tx-3'], t.colors.acc])
          expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(4.5);
      expect(t.fontUi).toBe(themeById(preset.id).fontUi);
    },
  );

  it('resolves every built colour to hex for email templates', () => {
    const t = buildTheme({ brand: '#0f766e', mode: 'dark', surfaces: 'tinted', font: 'source' });
    for (const [token, value] of Object.entries(toHexColors(t.colors))) {
      if (!value.startsWith('rgba(')) expect(value, token).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('applyTheme', () => {
  it('sets every token as an inline custom property and can clear them', () => {
    const el = document.createElement('div');
    const t = buildTheme({ brand: '#7c3aed', mode: 'light', surfaces: 'neutral', font: 'geist' });
    applyTheme(el, t);
    expect(el.style.getPropertyValue('--acc')).toBe('#7c3aed');
    expect(el.style.getPropertyValue('--ac')).toBe('#7c3aed');
    expect(el.style.getPropertyValue('--ai')).toBe('#9a85ea');
    expect(el.style.getPropertyValue('--e2')).toContain('rgba');
    expect(el.style.getPropertyValue('--font-ui')).toContain('Geist');
    expect(el.dataset['theme']).toBe('custom');
    clearTheme(el, 'light');
    expect(el.style.getPropertyValue('--ac')).toBe('');
    expect(el.style.getPropertyValue('--e2')).toBe('');
    expect(el.dataset['theme']).toBe('light');
  });
});
