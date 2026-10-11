/**
 * Builds the mark and lockup files from the designer's source in assets/brand/source. Run
 * `pnpm --filter @bemmoly/ui brand:marks` after the source changes, then `brand:icons`; the
 * output is committed. The wordmark files are drawn separately and only read here.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const brand = new URL('../assets/brand/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, brand), 'utf8');

/** The source's three colours, and the theme variable each one answers to in `-color`. */
const ROLES = {
  '#2356C9': { variable: '--brand-mark-bg', dark: '#1b2430', light: 1, mono: 1 },
  '#5B7BE5': { variable: '--brand-mark-mid', dark: '#4b5565', light: 0.8, mono: 0.75 },
  '#9A85EA': { variable: '--brand-mark-fg', dark: '#8690a0', light: 0.6, mono: 0.55 },
} as const;
type Hex = keyof typeof ROLES;
type Tone = 'color' | 'dark' | 'light' | 'mono';

interface Tile {
  hex: Hex;
  d: string;
}

function tilesOf(source: string): Tile[] {
  const tiles = [
    ...source.matchAll(/<path\b[^>]*\bfill="(#[0-9A-Fa-f]{6})"[^>]*\bd="([^"]+)"/g),
  ].map(([, fill = '', d = '']) => ({ hex: fill.toUpperCase() as Hex, d }));
  for (const tile of tiles) {
    if (!(tile.hex in ROLES)) throw new Error(`brand:marks: unexpected colour ${tile.hex}`);
  }
  if (tiles.length !== 4)
    throw new Error(`brand:marks: expected four tiles, found ${tiles.length}`);
  return tiles;
}

/** The tiles' bounds in source units, read from every coordinate pair in their paths. */
function bounds(tiles: readonly Tile[]) {
  const points = tiles.flatMap((tile) =>
    [...tile.d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [
      Number(x),
      Number(y),
    ]),
  );
  const xs = points.map(([x = 0]) => x);
  const ys = points.map(([, y = 0]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Fits the tiles into the 24-unit square, centred, so the mark fills the top bar's slot. */
function fit(tiles: readonly Tile[]): string {
  const { minX, maxX, minY, maxY } = bounds(tiles);
  const scale = 24 / Math.max(maxX - minX, maxY - minY);
  const x = (24 - (maxX - minX) * scale) / 2 - minX * scale;
  const y = (24 - (maxY - minY) * scale) / 2 - minY * scale;
  const n = (value: number) => Number(value.toFixed(4));
  return `translate(${n(x)} ${n(y)}) scale(${n(scale)})`;
}

function paint(hex: Hex, tone: Tone): string {
  const role = ROLES[hex];
  if (tone === 'color') return `style="fill: var(${role.variable}, ${hex})"`;
  if (tone === 'dark') return `fill="${role.dark}"`;
  const opacity = role[tone] === 1 ? '' : ` fill-opacity="${role[tone]}"`;
  return `fill="${tone === 'light' ? '#ffffff' : 'currentColor'}"${opacity}`;
}

function markBody(tiles: readonly Tile[], tone: Tone): string {
  const paths = tiles.map((tile) => `    <path ${paint(tile.hex, tone)} d="${tile.d}"/>`);
  return [`  <g transform="${fit(tiles)}">`, ...paths, '  </g>'].join('\n');
}

const svgOpen = (width: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24" role="img" aria-label="Bemmoly">`;

const inner = (svg: string) =>
  svg
    .replace(/^[\s\S]*?<svg\b[^>]*>\n?/, '')
    .replace(/<\/svg>\s*$/, '')
    .trimEnd();

/**
 * The lockup as the design review re-cut it (docs/design/premium/kit.css, `.bb`): a 10-unit
 * gap, and the lettering 15% larger, centred on the mark, so the word carries beside it.
 */
const GAP = 10;
const LETTER_SCALE = 1.15;
/** Lifts the scaled lettering so its capitals stay centred on the 24-unit mark. */
const LETTER_LIFT = -2.2;

const tiles = tilesOf(read('source/bemmoly-icon.svg'));
for (const tone of ['color', 'dark', 'light', 'mono'] as const) {
  const mark = markBody(tiles, tone);
  writeFileSync(new URL(`mark-${tone}.svg`, brand), `${svgOpen(24)}\n${mark}\n</svg>\n`);
  const wordmark = read(`wordmark-${tone}.svg`);
  const wordWidth = Number(/viewBox="0 0 ([\d.]+) 24"/.exec(wordmark)?.[1]);
  if (!wordWidth) throw new Error(`brand:marks: wordmark-${tone}.svg is not 24 units tall`);
  const offset = 24 + GAP;
  const lettering = inner(wordmark).replace(
    /<path\b/g,
    `<path transform="translate(${offset} ${LETTER_LIFT}) scale(${LETTER_SCALE})"`,
  );
  const width = Number((offset + wordWidth * LETTER_SCALE).toFixed(2));
  writeFileSync(
    new URL(`lockup-${tone}.svg`, brand),
    `${svgOpen(width)}\n${mark}\n${lettering}\n</svg>\n`,
  );
}
