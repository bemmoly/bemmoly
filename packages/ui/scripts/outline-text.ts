/**
 * Text as SVG paths in the self-hosted fonts, for generated images that must render without
 * the fonts installed (resvg draws no web fonts).
 */
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

export type Family = 'ibm-plex-sans' | 'ibm-plex-mono';

export interface TextStyle {
  family: Family;
  weight: 400 | 500 | 600;
  size: number;
  /** In em, as CSS letter-spacing: -0.02 tightens a headline. */
  tracking?: number;
}

type Font = ReturnType<typeof opentype.parse>;

const fonts = new Map<string, Font>();

function fontOf({ family, weight }: TextStyle): Font {
  const key = `${family}-${weight}`;
  const cached = fonts.get(key);
  if (cached) return cached;
  const file = new URL(
    `../node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff`,
    import.meta.url,
  );
  const buffer = readFileSync(file);
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  fonts.set(key, font);
  return font;
}

/** opentype.js reads a glyph's metrics lazily, with its outline; load it before measuring. */
function advance(font: Font, ch: string, style: TextStyle): number {
  const glyph = font.charToGlyph(ch);
  glyph.getPath(0, 0, style.size);
  if (!Number.isFinite(glyph.advanceWidth)) throw new Error(`No advance width for "${ch}"`);
  return (glyph.advanceWidth / font.unitsPerEm) * style.size + (style.tracking ?? 0) * style.size;
}

export function measure(text: string, style: TextStyle): number {
  const font = fontOf(style);
  return [...text].reduce((sum, ch) => sum + advance(font, ch, style), 0);
}

type Glyph = ReturnType<Font['charToGlyph']>;

/**
 * A glyph's outline as path data. opentype.js's own toPathData sometimes prints NaN for a
 * coordinate at some offsets, so the commands are written out here.
 */
function pathData(glyph: Glyph, x: number, y: number, size: number): string {
  const n = (value: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) throw new Error('Glyph has no outline');
    return value.toFixed(2);
  };
  return glyph
    .getPath(x, y, size)
    .commands.map((c) => {
      if (c.type === 'Z') return 'Z';
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      return `${c.type}${n(c.x)} ${n(c.y)}`;
    })
    .join('');
}

/** Path data for one line; `x` is the left edge unless `centre` is set. */
export function outline(
  text: string,
  style: TextStyle,
  x: number,
  baseline: number,
  centre = false,
): string {
  const font = fontOf(style);
  let cursor = centre ? x - measure(text, style) / 2 : x;
  return [...text]
    .map((ch) => {
      const d = pathData(font.charToGlyph(ch), cursor, baseline, style.size);
      cursor += advance(font, ch, style);
      return d;
    })
    .join('');
}

/** Greedy word wrap to `width`. */
export function wrap(text: string, style: TextStyle, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, style) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
