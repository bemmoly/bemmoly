import { describe, expect, it } from 'vitest';
import { resolveSource, resolveTheme, themeSource } from '../tokens.ts';
import {
  applyTheme,
  buildCustomTheme,
  clearTheme,
  contrastRatio,
  customThemeSource,
  toHexColors,
} from './index.ts';

const random = (() => {
  let seed = 7;
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0xffffff;
})();
const COLOURS = [
  '#2356c9',
  '#facc15',
  '#e8590c',
  '#0f766e',
  '#111827',
  '#7c3aed',
  '#ffffff',
  '#000000',
  ...Array.from({ length: 1500 }, () => `#${Math.floor(random()).toString(16).padStart(6, '0')}`),
];

describe('buildCustomTheme', () => {
  it.each(['neutral', 'warm'] as const)(
    'passes all fourteen checks in both modes for 1,500 random %s brands',
    (surface) => {
      for (const brand of COLOURS) {
        const theme = buildCustomTheme({ brand, surface });
        const failed = [...theme.checks.light, ...theme.checks.dark].filter((c) => !c.pass);
        expect(failed.map((c) => `${brand} ${c.label} ${c.ratio.toFixed(2)}`)).toEqual([]);
        expect(theme.pass).toBe(true);
      }
    },
  );

  it('keeps the surfaces of the chosen style and only moves the accent tokens', () => {
    const neutral = buildCustomTheme({ brand: '#0f766e', surface: 'neutral' });
    const warm = buildCustomTheme({ brand: '#0f766e', surface: 'warm' });
    for (const token of ['canvas', 'side', 'sunken', 'card', 'line', 'tx', 'tx-3'] as const) {
      expect(neutral.light[token]).toBe(themeSource('bemmoly').light[token]);
      expect(neutral.dark[token]).toBe(themeSource('bemmoly').dark[token]);
      expect(warm.light[token]).toBe(themeSource('sand').light[token]);
    }
  });

  it('reproduces the Bemmoly accent for the logo blue in light mode', () => {
    const theme = buildCustomTheme({ brand: '#2356C9', surface: 'neutral' });
    expect(theme.brand).toBe('#2356c9');
    expect(theme.light.acc).toBe('#2356c9');
    expect(theme.light['acc-fill']).toBe('#2356c9');
    expect(theme.adjusted).toBe(true);
    expect(theme.guard).toBeNull();
  });

  it('darkens a light brand for links and buttons and says it did', () => {
    const theme = buildCustomTheme({ brand: '#facc15', surface: 'neutral' });
    expect(theme.adjusted).toBe(true);
    expect(theme.light.acc).not.toBe('#facc15');
    expect(contrastRatio('#ffffff', theme.light['acc-fill'])).toBeGreaterThanOrEqual(4.5);
    expect(theme.guard?.means).toMatch(/orange and amber/);
  });

  it('warns on reserved hues but still builds them', () => {
    expect(buildCustomTheme({ brand: '#e11d48', surface: 'neutral' }).guard?.means).toMatch(/red/);
    expect(buildCustomTheme({ brand: '#7c3aed', surface: 'warm' }).guard?.means).toMatch(/lilac/);
    expect(buildCustomTheme({ brand: '#16a34a', surface: 'neutral' }).pass).toBe(true);
  });

  it('rejects anything that is not six hex digits', () => {
    expect(() => buildCustomTheme({ brand: 'teal', surface: 'neutral' })).toThrow(/six hex/);
  });

  it('turns into a theme source that resolves in both modes', () => {
    const source = customThemeSource('c-1', 'Acme', { brand: '#0f766e', surface: 'neutral' });
    const dark = resolveSource(source, 'dark');
    expect(dark).toMatchObject({ id: 'c-1', name: 'Acme', mode: 'dark' });
    for (const [token, value] of Object.entries(toHexColors(dark.colors)))
      if (!value.startsWith('rgba(')) expect(value, token).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('applyTheme', () => {
  it('sets every token as an inline custom property, never the font, and can clear them', () => {
    const el = document.createElement('div');
    applyTheme(el, resolveTheme('pine', 'dark'));
    expect(el.style.getPropertyValue('--acc')).toBe('#5fc0a8');
    expect(el.style.getPropertyValue('--type-task')).toBe('#5b7be5');
    expect(el.style.getPropertyValue('--ai')).toBe('#9a85ea');
    expect(el.style.getPropertyValue('--e2')).toContain('rgba');
    expect(el.style.getPropertyValue('--font-ui')).toBe('');
    expect(el.dataset).toMatchObject({ theme: 'pine', mode: 'dark' });
    clearTheme(el, 'bemmoly');
    expect(el.style.getPropertyValue('--acc')).toBe('');
    expect(el.style.getPropertyValue('--type-task')).toBe('');
    expect(el.dataset['theme']).toBe('bemmoly');
  });
});
