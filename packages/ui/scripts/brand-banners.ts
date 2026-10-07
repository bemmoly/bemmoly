/**
 * Generates the profile banners (X, LinkedIn, Buy Me a Coffee), the README hero and the
 * repository social preview into assets/brand/generated, in the Classic light preset and,
 * for comparison, in Ocean (`-ocean`). `brand:icons` runs this too. `--debug <dir>` also
 * writes review copies with the safe zones drawn to <dir>; those are not committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { themeById } from '../src/tokens.ts';
import { checkZones, composeBanner, debugOverlay } from './banner-layout.ts';
import { BANNERS, README_HERO } from './banner-specs.ts';
import { BOARD, BOARD_OCEAN, wideCard } from './social-preview.ts';

const brand = new URL('../assets/brand/', import.meta.url);
const out = new URL('generated/', brand);

/** Classic is the approved look; Ocean is rendered beside it for the owner to compare. */
const THEMES = [
  { suffix: '', preset: 'light', board: BOARD },
  { suffix: '-ocean', preset: 'ocean', board: BOARD_OCEAN },
] as const;

function colorsOf(preset: string) {
  const theme = themeById(preset);
  if (theme.id !== preset) throw new Error(`No "${preset}" preset in the tokens`);
  return theme.colors;
}

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

/** The -color lockup with its theme hooks at their designed colours and the lettering in `text`. */
function lockup(text: string): string {
  return readFileSync(new URL('lockup-color.svg', brand), 'utf8')
    .replace(/style="fill: var\(--brand-mark-[\w-]+,\s*([^)]+)\)"/g, 'fill="$1"')
    .replace(/currentColor/g, text);
}

export function writeBanners(debugDir?: string): string[] {
  mkdirSync(out, { recursive: true });
  if (debugDir) mkdirSync(debugDir, { recursive: true });
  const written: string[] = [];
  const write = (name: string, data: Buffer) => {
    writeFileSync(new URL(name, out), data);
    written.push(name);
  };
  for (const { suffix, preset, board } of THEMES) {
    const colors = colorsOf(preset);
    for (const spec of [...BANNERS, README_HERO]) {
      const { svg, boxes } = composeBanner(spec, { colors, board, lockup: lockup(colors.tx) });
      checkZones(spec, boxes);
      for (const scale of spec.scales) {
        const at = scale === 1 ? '' : `@${scale}x`;
        write(`${spec.name}${suffix}${at}.png`, png(svg, spec.width * scale));
      }
      if (debugDir) {
        const marks = { safe: colors.ok, covered: colors.danger };
        const review = debugOverlay(svg, spec, boxes, marks);
        writeFileSync(
          resolve(debugDir, `${spec.name}${suffix}.debug.png`),
          png(review, spec.width),
        );
      }
    }
    // Shown in link unfurls with no avatar beside it, so this one keeps the lockup.
    const github = wideCard({ lockup: lockup(colors.tx), colors, board }, 1280, 640);
    write(`github-social-preview-1280x640${suffix}.png`, png(github, 1280));
  }
  return written;
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--debug');
  const debugDir = flag === -1 ? undefined : process.argv[flag + 1];
  if (flag !== -1 && !debugDir) throw new Error('--debug needs a directory');
  writeBanners(debugDir && resolve(debugDir));
}
