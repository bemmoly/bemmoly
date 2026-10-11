/**
 * The header's Sponsor link is rose text on a rose tint (ADR 0033), and its Star on GitHub link
 * amber text on an amber tint. Its colours are site-only
 * aliases of the product's red-tx and red-50 (src/styles/site.css), so this checks the text
 * holds AA (4.5:1) on the canvas and on the tint, in light and in dark.
 */
import { readFileSync } from 'node:fs';
import { resolveTheme } from '@bemmoly/ui/tokens';
import { describe, expect, it } from 'vitest';

type Rgba = [number, number, number, number];

function parse(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1) as Rgba;
  const rgba = /^rgba?\(([^)]+)\)$/.exec(color)?.[1]?.split(',').map(Number);
  if (rgba && rgba.length >= 3) return [rgba[0] ?? 0, rgba[1] ?? 0, rgba[2] ?? 0, rgba[3] ?? 1];
  throw new Error(`Unreadable colour ${color}`);
}

const over = (top: Rgba, base: Rgba): Rgba =>
  [0, 1, 2].map((i) => (top[i] ?? 0) * top[3] + (base[i] ?? 0) * (1 - top[3])).concat(1) as Rgba;

function luminance([r, g, b]: Rgba): number {
  const [x, y, z] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (x ?? 0) + 0.7152 * (y ?? 0) + 0.0722 * (z ?? 0);
}

const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe('sponsor colours', () => {
  it('are aliases of the product red, not literals', () => {
    const css = readFileSync(new URL('../src/styles/site.css', import.meta.url), 'utf8');
    expect(css).toContain('--color-sponsor: var(--red-tx);');
    expect(css).toContain('--color-sponsor-soft: var(--red-50);');
    expect(css).toContain('--color-star: var(--amber-tx);');
    expect(css).toContain('--color-star-soft: var(--amber-50);');
  });

  it.each(['light', 'dark'] as const)('hold AA in %s', (mode) => {
    const { colors } = resolveTheme('bemmoly', mode);
    const canvas = parse(colors.canvas);
    const text = parse(colors['red-tx']);
    const tint = over(parse(colors['red-50']), canvas);
    expect(contrast(text, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, tint)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['light', 'dark'] as const)('the star link holds AA in %s', (mode) => {
    const { colors } = resolveTheme('bemmoly', mode);
    const canvas = parse(colors.canvas);
    const text = parse(colors['amber-tx']);
    const tint = over(parse(colors['amber-50']), canvas);
    expect(contrast(text, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, tint)).toBeGreaterThanOrEqual(4.5);
  });
});
