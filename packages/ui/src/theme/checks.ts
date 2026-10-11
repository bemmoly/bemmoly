/**
 * The fourteen contrast checks every theme set passes, built-in or custom (ADR 0021), and the
 * reserved hue bands no accent may sit in without a warning. The same functions gate the
 * custom theme generator, the token tests and the server's save.
 */
import { MODE_COLORS, MODE_TYPE_COLORS } from '../tokens/semantic.ts';
import type { ThemeMode, ThemeSet } from '../tokens/names.ts';
import { parseHex } from './color.ts';
import { contrastRatio } from './contrast.ts';

export interface ThemeCheck {
  id: string;
  label: string;
  /** The pair measured, as token names. */
  pair: string;
  ratio: number;
  min: number;
  pass: boolean;
}

const surfacesOf = (t: ThemeSet) => [t.canvas, t.side, t.sunken, t.card];

/** The fourteen checks for one set; the high-contrast theme is held to 7:1 text. */
export function themeChecks(t: ThemeSet, mode: ThemeMode, highContrast = false): ThemeCheck[] {
  const fixed = { ...MODE_COLORS[mode], ...MODE_TYPE_COLORS[mode] };
  const onSurfaces = (ink: string) => Math.min(...surfacesOf(t).map((s) => contrastRatio(ink, s)));
  const text = highContrast ? 7 : 4.5;
  const rows: [string, string, string, number, number][] = [
    ['tx', 'Body text, every surface', 'tx', onSurfaces(t.tx), text],
    ['tx-2', 'Secondary text, every surface', 'tx-2', onSurfaces(t['tx-2']), text],
    ['tx-3', 'Muted text, every surface', 'tx-3', onSurfaces(t['tx-3']), 4.5],
    ['acc', 'Links and accent text, every surface', 'acc', onSurfaces(t.acc), 4.5],
    [
      'on-acc',
      'Label on primary button',
      'on-acc / acc-fill',
      contrastRatio(t['on-acc'], t['acc-fill']),
      4.5,
    ],
    [
      'acc-fill',
      'Primary button against page',
      'acc-fill / canvas',
      contrastRatio(t['acc-fill'], t.canvas),
      3,
    ],
    ['focus', 'Focus ring against page', 'acc / canvas', contrastRatio(t.acc, t.canvas), 3],
    ['acc-50', 'Text on a selected row', 'tx / acc-50', contrastRatio(t.tx, t['acc-50']), text],
    ['ai', 'AI text on card', 'ai-600 / card', contrastRatio(fixed['ai-600'], t.card), 4.5],
    ['todo', 'To-do status glyph on card', 'todo / card', contrastRatio(fixed.todo, t.card), 3],
    [
      'type-task',
      'Task type tile on card',
      'type-task / card',
      contrastRatio(fixed['type-task'], t.card),
      3,
    ],
    [
      'type-epic',
      'Epic type tile on card',
      'type-epic / card',
      contrastRatio(fixed['type-epic'], t.card),
      3,
    ],
    ['red-tx', 'Error text on card', 'red-tx / card', contrastRatio(fixed['red-tx'], t.card), 4.5],
    [
      'line',
      'Control border on card',
      'line / card',
      contrastRatio(t.line, t.card),
      highContrast ? 3 : 1.15,
    ],
  ];
  return rows.map(([id, label, pair, ratio, min]) => ({
    id,
    label,
    pair,
    ratio,
    min,
    pass: ratio >= min,
  }));
}

export interface ReservedHue {
  /** Degrees, inclusive; a band that wraps past 360 has from > to. */
  from: number;
  to: number;
  /** What the hue already means, for the warning. */
  means: string;
}

/** Hue bands that already carry meaning, so no accent may use them without a warning. */
export const RESERVED_HUES: readonly ReservedHue[] = [
  { from: 340, to: 12, means: 'red, which means errors, Bug and Blocked' },
  { from: 18, to: 50, means: 'orange and amber, which mean warnings and Incident' },
  { from: 120, to: 155, means: 'green, which means Done and Story' },
  { from: 255, to: 290, means: 'lilac and violet, which mean AI and Epic' },
];

/** The HSL hue of a hex colour, or null for a near-grey that has no hue to speak of. */
export function hueOf(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d < 0.08) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const deg = h * 60;
  return deg < 0 ? deg + 360 : deg;
}

/** The reserved band a colour sits in, or null when it is clear of all of them. */
export function reservedHue(hex: string): ReservedHue | null {
  const hue = hueOf(hex);
  if (hue === null) return null;
  return (
    RESERVED_HUES.find(({ from, to }) =>
      from > to ? hue >= from || hue <= to : hue >= from && hue <= to,
    ) ?? null
  );
}
