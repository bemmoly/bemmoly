/**
 * Colour arithmetic for the theme builder: parsing, CSS color-mix() evaluation and
 * conversion between sRGB and OKLab. Dependency-free so the builder runs in the
 * browser, in tests and in server-rendered email templates alike.
 */

export type Rgb = readonly [number, number, number];

const clamp = (v: number) => Math.min(255, Math.max(0, v));

export function parseHex(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(clamp(c)).toString(16).padStart(2, '0')).join('')}`;
}

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (l: number) =>
  255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.sign(l) * Math.abs(l) ** (1 / 2.4) - 0.055);

function rgbToOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export type MixSpace = 'oklab' | 'srgb';

/** The CSS for `color-mix(in <space>, <a> <percent>%, <b>)`. */
export function mixCss(a: string, percent: number, b: string, space: MixSpace = 'oklab'): string {
  return `color-mix(in ${space}, ${a} ${percent}%, ${b})`;
}

/** Evaluates `color-mix(in <space>, a p%, b)` the way a browser does, returning hex. */
export function mixHex(a: string, percent: number, b: string, space: MixSpace = 'oklab'): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`mixHex needs hex colours, got ${a} and ${b}`);
  const p = percent / 100;
  const lerp = (x: Rgb, y: Rgb): Rgb => [
    x[0] * p + y[0] * (1 - p),
    x[1] * p + y[1] * (1 - p),
    x[2] * p + y[2] * (1 - p),
  ];
  if (space === 'srgb') return toHex(lerp(ca, cb));
  return toHex(oklabToRgb(lerp(rgbToOklab(ca), rgbToOklab(cb))));
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(body.slice(start).trim());
  return parts;
}

/** Resolves a token value (hex, or color-mix() over hex values, nested) to hex. */
export function resolveHex(value: string): string {
  const v = value.trim();
  const parsed = parseHex(v);
  if (parsed) return toHex(parsed);
  if (!v.startsWith('color-mix(') || !v.endsWith(')')) {
    throw new Error(`Cannot resolve colour ${value}`);
  }
  const [space, first, second] = splitTopLevel(v.slice('color-mix('.length, -1));
  const pm = /^(.*)\s([\d.]+)%$/.exec(first ?? '');
  if (!space || !pm || !second) throw new Error(`Cannot resolve colour ${value}`);
  const mixSpace = space.replace(/^in\s+/, '') as MixSpace;
  return mixHex(resolveHex(pm[1] ?? ''), Number(pm[2]), resolveHex(second), mixSpace);
}

/** Largest per-channel difference between two colours, in 0–255 steps. */
export function channelDistance(a: string, b: string): number {
  const ca = parseHex(resolveHex(a)) as Rgb;
  const cb = parseHex(resolveHex(b)) as Rgb;
  return Math.max(...ca.map((v, i) => Math.abs(v - (cb[i] as number))));
}
