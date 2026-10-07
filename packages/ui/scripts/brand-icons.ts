/**
 * Generates favicons, PWA icons and the social preview from the brand files in assets/brand,
 * then the banners (brand-banners.ts).
 * Run `pnpm --filter @bemmoly/ui brand:icons` after replacing a brand file; the output in
 * assets/brand/generated is committed. The mark keeps its designed colours; the plates behind
 * it come from the Classic preset in tokens.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { themeById } from '../src/tokens.ts';
import { writeBanners } from './brand-banners.ts';
import { squareCard, wideCard } from './social-preview.ts';

const brand = new URL('../assets/brand/', import.meta.url);
const out = new URL('generated/', brand);
const classic = themeById('light').colors;

const read = (name: string) => readFileSync(new URL(name, brand), 'utf8');

/** A -color file with every theme hook at its designed fallback, for places without CSS. */
function resolveColors(svg: string, text: string): string {
  return svg
    .replace(/style="fill: var\(--brand-mark-[\w-]+,\s*([^)]+)\)"/g, 'fill="$1"')
    .replace(/currentColor/g, text);
}

/**
 * The mark for the accent plate of the maskable icons: the designed blue tiles would vanish
 * on a blue plate, so they turn white, the mid tile a softer white, and the lilac stays.
 */
function onAccent(svg: string): string {
  return svg
    .replace(/style="fill: var\(--brand-mark-bg,[^)]+\)"/g, 'fill="#ffffff"')
    .replace(/style="fill: var\(--brand-mark-mid,[^)]+\)"/g, 'fill="#ffffff" fill-opacity="0.8"')
    .replace(/style="fill: var\(--brand-mark-fg,\s*([^)]+)\)"/g, 'fill="$1"');
}

const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const viewBox = (svg: string) =>
  /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 24, 24];

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

/**
 * The mark centred on a square plate at `scale` of its width. A rounded plate keeps launchers
 * from filling behind a transparent mark; `radius` 0 is full bleed for platforms that round
 * the corners themselves.
 */
function plate(mark: string, scale: number, fill: string, radius: number): string {
  const [, , w = 24, h = 24] = viewBox(mark);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" rx="${radius * w}" fill="${fill}"/>`,
    `<g transform="translate(${((1 - scale) * w) / 2} ${((1 - scale) * h) / 2}) scale(${scale})">${inner(mark)}</g>`,
    '</svg>',
  ].join('');
}

/** The mark at 72% on a white plate; Android masks it, browsers show the rounded corners. */
const ICON_SCALE = 0.72;
const ICON_RADIUS = 0.225;
/** The maskable safe zone is the central 80% circle; 64% keeps every tile inside it. */
const MASKABLE_SCALE = 0.64;
const ACCENT = '#2356C9';

mkdirSync(out, { recursive: true });
const source = read('mark-color.svg');
const favicon = resolveColors(source, classic.tx);
const icon = plate(favicon, ICON_SCALE, classic.sf, ICON_RADIUS);
const maskable = plate(onAccent(source), MASKABLE_SCALE, ACCENT, 0);
const preview = { lockup: resolveColors(read('lockup-color.svg'), classic.tx), colors: classic };
const files: Record<string, string | Buffer> = {
  'favicon.svg': favicon,
  'favicon-32.png': png(icon, 32),
  // iOS rounds the corners itself and paints transparent ones black, so this plate is square.
  'apple-touch-icon.png': png(plate(favicon, ICON_SCALE, classic.sf, 0), 180),
  'icon-192.png': png(icon, 192),
  'icon-512.png': png(icon, 512),
  'icon-maskable-192.png': png(maskable, 192),
  'icon-maskable-512.png': png(maskable, 512),
  'social-preview.png': png(wideCard(preview), 1200),
  'social-preview-square.png': png(squareCard(preview), 1080),
};
for (const [name, data] of Object.entries(files)) writeFileSync(new URL(name, out), data);
writeBanners();
