/** WCAG 2 relative luminance and contrast ratio, the maths every theme check runs on. */
import { resolveHex } from './color.ts';

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two colours (hex or color-mix()), unrounded. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(resolveHex(a)), luminance(resolveHex(b))].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
