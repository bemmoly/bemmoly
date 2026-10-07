/**
 * Generates favicons, PWA icons and the social preview from the brand files in assets/brand.
 * Run `pnpm --filter @bemmoly/ui brand:icons` after replacing a brand file; the output in
 * assets/brand/generated is committed. Colours come from the Classic preset in tokens.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import { themeById } from '../src/tokens.ts';

const brand = new URL('../assets/brand/', import.meta.url);
const out = new URL('generated/', brand);
const classic = themeById('light').colors;
const BG = classic['ac-fill'];
const FG = classic['on-ac'];

const read = (name: string) => readFileSync(new URL(name, brand), 'utf8');

/** A -color file with its theme hooks replaced by Classic's colours, for places without CSS. */
function resolveColors(svg: string, text: string): string {
  return svg
    .replace(/var\(--brand-mark-bg[^)]*\)/g, BG)
    .replace(/var\(--brand-mark-fg[^)]*\)/g, FG)
    .replace(/currentColor/g, text);
}

const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const viewBox = (svg: string) =>
  /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 24, 24];

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

/** The mark on a full-bleed square of the tile colour; `scale` keeps it inside a safe zone. */
function fullBleed(mark: string, scale: number): string {
  const [, , w = 24, h = 24] = viewBox(mark);
  const offset = ((1 - scale) * w) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${BG}"/>`,
    `<g transform="translate(${offset} ${((1 - scale) * h) / 2}) scale(${scale})">${inner(mark)}</g>`,
    '</svg>',
  ].join('');
}

function outlineText(
  text: string,
  size: number,
  x: number,
  baseline: number,
  weight: 400 | 600,
): string {
  const file = new URL(
    `../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff`,
    import.meta.url,
  );
  const buffer = readFileSync(file);
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  const width = [...text].reduce(
    (sum, ch) => sum + (font.charToGlyph(ch).advanceWidth / font.unitsPerEm) * size,
    0,
  );
  let cursor = x - width / 2;
  return [...text]
    .map((ch) => {
      const glyph = font.charToGlyph(ch);
      const d = glyph.getPath(cursor, baseline, size).toPathData(2);
      cursor += (glyph.advanceWidth / font.unitsPerEm) * size;
      return d;
    })
    .join('');
}

/** 1200 x 630 placeholder: the lockup and the tagline on the Classic page background. */
function socialPreview(): string {
  const lockup = resolveColors(read('lockup-color.svg'), classic.tx);
  const [, , w = 94, h = 24] = viewBox(lockup);
  const scale = 4;
  const x = (1200 - w * scale) / 2;
  const tagline = outlineText('Your work. Your platform.', 34, 600, 355, 400);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">',
    `<rect width="1200" height="630" fill="${classic.bg}"/>`,
    `<g transform="translate(${x} ${270 - h * scale}) scale(${scale})">${inner(lockup)}</g>`,
    `<path fill="${classic.tx4}" d="${tagline}"/>`,
    '</svg>',
  ].join('');
}

mkdirSync(out, { recursive: true });
const favicon = resolveColors(read('mark-color.svg'), classic.tx);
const files: Record<string, string | Buffer> = {
  'favicon.svg': favicon,
  'favicon-32.png': png(favicon, 32),
  'apple-touch-icon.png': png(fullBleed(favicon, 1), 180),
  'icon-192.png': png(favicon, 192),
  'icon-512.png': png(favicon, 512),
  'icon-maskable-192.png': png(fullBleed(favicon, 0.8), 192),
  'icon-maskable-512.png': png(fullBleed(favicon, 0.8), 512),
  'social-preview.png': png(socialPreview(), 1200),
};
for (const [name, data] of Object.entries(files)) writeFileSync(new URL(name, out), data);
