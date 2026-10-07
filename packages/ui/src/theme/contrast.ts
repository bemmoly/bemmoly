/**
 * The contrast check of the Appearance Settings mock, ported exactly: its `lum` (WCAG
 * relative luminance with the 0.03928 threshold, 0.5 for anything that is not six hex
 * digits), its `ratio` (white against the brand, rounded with toFixed(1)) and its three
 * messages, chosen on the rounded ratio as the mock does.
 */
import { mixHex } from './color.ts';

export type ContrastLevel = 'pass' | 'darken' | 'dark-text';

export interface ContrastResult {
  /** White on the brand, as the mock displays it ("4.6"). */
  ratio: string;
  level: ContrastLevel;
  message: string;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White text on `hex`, rounded to one decimal like the mock. */
export function whiteContrast(hex: string): string {
  return (1.05 / (luminance(hex) + 0.05)).toFixed(1);
}

export function contrastCheck(brand: string): ContrastResult {
  const ratio = whiteContrast(brand);
  const value = Number(ratio);
  if (value >= 4.5) {
    return {
      ratio,
      level: 'pass',
      message: `White text on ${brand} is ${ratio}:1. Passes for buttons and labels.`,
    };
  }
  if (value >= 3) {
    return {
      ratio,
      level: 'darken',
      message: `White text on ${brand} is ${ratio}:1. We'll darken it for button text so it stays readable.`,
    };
  }
  return {
    ratio,
    level: 'dark-text',
    message: `${brand} is too light for white text (${ratio}:1). We'll use dark text on buttons and a darker shade for links.`,
  };
}

/**
 * The lightest shade of `brand` (mixed toward black in OKLab, like the mock's darker accent)
 * that carries white text at 4.5:1 by the same check.
 */
export function darkenForWhiteText(brand: string): string {
  for (let keep = 100; keep >= 0; keep -= 2) {
    const shade = keep === 100 ? brand.toLowerCase() : mixHex(brand, keep, '#000000');
    if (Number(whiteContrast(shade)) >= 4.5) return shade;
  }
  return '#000000';
}
