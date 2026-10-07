/**
 * The profile banners: the social preview's copy and Board frame without the lockup, since
 * every platform shows the mark as the profile picture beside the banner. A banner is laid
 * out from a spec (banner-specs.ts) and refuses to render if any text leaves the spec's safe
 * zone or touches an area the platform covers.
 */
import { RADII } from '../src/tokens.ts';
import { measure, outline, wrap, type TextStyle } from './outline-text.ts';
import {
  boardFrame,
  COMMAND,
  HEADLINE,
  LINE,
  shadowFilter,
  type PreviewInput,
} from './social-preview.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BannerSpec {
  /** File stem, with the size: `banner-x-1500x500`. */
  name: string;
  width: number;
  height: number;
  /** Export scales; 2 for platforms that downscale a larger upload. */
  scales: readonly number[];
  /** Every text box must sit inside this. */
  safe: Rect;
  /** What the platform paints over the banner (avatar, logo, page cards). */
  covered: readonly Rect[];
  copy: {
    x: number;
    /** Wrap width for the line; the headline must fit it unwrapped. */
    width: number;
    /** Where the headline may run wider than the line, above an avatar column. */
    headlineWidth?: number;
    /** Top of the block; centred in `safe` when omitted. */
    top?: number;
    headline: TextStyle;
    /** One sentence per line, as the social preview has it. */
    split: boolean;
    body: TextStyle;
    /** The install pill, or none where it cannot be read at the platform's size. */
    code?: TextStyle;
  };
  /** The Board frame, bleeding off the right (and usually the bottom) edge. */
  frame: { rect: Rect; scale: number; from?: { x: number; y: number } };
  /** "bemmoly.com", right-aligned at `right`; the banners' only name, so not on the hero. */
  domain?: { style: TextStyle; right: number; baseline: number };
  /** The lockup, only where no avatar shows the mark beside the image (the README hero). */
  lockup?: { x: number; y: number; height: number };
  /** The accent glow's centre and radius. */
  glow: { cx: number; cy: number; r: number };
}

export type BannerInput = Pick<PreviewInput, 'colors' | 'board'> & {
  /** The -color lockup with its colours resolved, for a spec that places one. */
  lockup?: string;
};

const DOMAIN = 'bemmoly.com';
const px = (value: string) => Number.parseFloat(value);

/** The box a line of text inks, from its baseline: Plex ascends about 0.8em, descends 0.22. */
const textBox = (x: number, baseline: number, text: string, style: TextStyle): Rect => ({
  x,
  y: baseline - style.size * 0.8,
  w: measure(text, style),
  h: style.size * 1.02,
});

/**
 * The fewest lines `width` allows, then the narrowest width that keeps that count, as CSS
 * `text-wrap: balance` does: no one-word last line under a long first one.
 */
function balanced(text: string, style: TextStyle, width: number): string[] {
  let best = wrap(text, style, width);
  for (let narrower = width - 4; narrower > 0; narrower -= 4) {
    const next = wrap(text, style, narrower);
    if (next.length !== best.length) break;
    best = next;
  }
  return best;
}

/** The headline, the line and the pill from `top`, with the social preview's rhythm. */
function copyBlock(spec: BannerSpec, input: BannerInput, top: number) {
  const { colors } = input;
  const { x, width, headline, body, code } = spec.copy;
  const titles = spec.copy.split ? HEADLINE.split(/(?<=\.) /) : [HEADLINE];
  const parts: string[] = [];
  const boxes: Rect[] = [];
  let y = top;
  for (const title of titles) {
    if (measure(title, headline) > (spec.copy.headlineWidth ?? width))
      throw new Error(`${spec.name}: "${title}" overflows`);
    y += headline.size;
    parts.push(`<path fill="${colors.tx}" d="${outline(title, headline, x, y)}"/>`);
    boxes.push(textBox(x, y, title, headline));
    y += headline.size * 0.125;
  }
  y += headline.size * 0.25;
  for (const line of balanced(LINE, body, width)) {
    y += body.size * 1.3;
    const baseline = y - body.size * 0.3;
    parts.push(`<path fill="${colors.tx2}" d="${outline(line, body, x, baseline)}"/>`);
    boxes.push(textBox(x, baseline, line, body));
  }
  if (code) {
    y += code.size * 1.4;
    const pill = { x, y, w: measure(COMMAND, code) + code.size * 2, h: code.size * 2.4 };
    parts.push(
      `<rect x="${pill.x}" y="${pill.y}" width="${pill.w}" height="${pill.h}" rx="${px(RADII.card)}" fill="${colors.sf}" stroke="${colors.br}"/>`,
      `<path fill="${colors.tx}" d="${outline(COMMAND, code, x + code.size, y + code.size * 1.55)}"/>`,
    );
    boxes.push(pill);
    y += pill.h;
  }
  return { svg: parts.join(''), boxes, height: y - top };
}

/** The lockup at `place`, scaled from its 24-unit-tall viewBox; returns the svg and its box. */
function lockupAt(svg: string, place: NonNullable<BannerSpec['lockup']>) {
  const scale = place.height / 24;
  const viewWidth = Number(/viewBox="0 0 ([\d.]+) 24"/.exec(svg)?.[1] ?? 24);
  const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return {
    svg: `<g transform="translate(${place.x} ${place.y}) scale(${scale})">${inner}</g>`,
    box: { x: place.x, y: place.y, w: viewWidth * scale, h: place.height },
  };
}

export function composeBanner(spec: BannerSpec, input: BannerInput) {
  const { colors } = input;
  const { width, height, safe, glow, domain } = spec;
  if (spec.lockup && !input.lockup) throw new Error(`${spec.name}: the spec places a lockup`);
  const brand = spec.lockup && input.lockup ? lockupAt(input.lockup, spec.lockup) : undefined;
  const probe = copyBlock(spec, input, 0);
  // The block's first line inks from 0.2em below its top; centre the ink, not the leading.
  const lead = spec.copy.headline.size * 0.2;
  const top = spec.copy.top ?? safe.y + (safe.h - probe.height + lead) / 2 - lead;
  const copy = copyBlock(spec, input, top);
  const domainX = domain ? domain.right - measure(DOMAIN, domain.style) : 0;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    `<radialGradient id="glow" cx="${glow.cx}" cy="${glow.cy}" r="${glow.r}" gradientUnits="userSpaceOnUse">`,
    `<stop offset="0" stop-color="${colors.ac}" stop-opacity="0.14"/>`,
    `<stop offset="1" stop-color="${colors.ac}" stop-opacity="0"/>`,
    '</radialGradient>',
    shadowFilter('shadow'),
    '</defs>',
    `<rect width="${width}" height="${height}" fill="${colors.bg}"/>`,
    `<rect width="${width}" height="${height}" fill="url(#glow)"/>`,
    boardFrame(input, spec.frame.rect, spec.frame.scale, spec.frame.from),
    brand?.svg ?? '',
    copy.svg,
    domain
      ? `<path fill="${colors.tx3}" d="${outline(DOMAIN, domain.style, domainX, domain.baseline)}"/>`
      : '',
    '</svg>',
  ].join('');
  const boxes = [...copy.boxes];
  if (domain) boxes.push(textBox(domainX, domain.baseline, DOMAIN, domain.style));
  if (brand) boxes.push(brand.box);
  return { svg, boxes };
}

const inside = (box: Rect, zone: Rect) =>
  box.x >= zone.x &&
  box.y >= zone.y &&
  box.x + box.w <= zone.x + zone.w &&
  box.y + box.h <= zone.y + zone.h;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Every text box inside the safe zone, clear of covered areas and of the Board frame. */
export function checkZones(spec: BannerSpec, boxes: readonly Rect[]): void {
  for (const box of boxes) {
    const where = `${spec.name}: text at ${box.x.toFixed(0)},${box.y.toFixed(0)}`;
    if (!inside(box, spec.safe)) throw new Error(`${where} leaves the safe zone`);
    if (spec.covered.some((zone) => overlaps(box, zone)))
      throw new Error(`${where} sits under a covered area`);
    if (overlaps(box, spec.frame.rect)) throw new Error(`${where} runs into the Board frame`);
  }
}

/** A review copy with the safe zone outlined, covered areas shaded and text boxes traced. */
export function debugOverlay(
  svg: string,
  spec: BannerSpec,
  boxes: readonly Rect[],
  marks: { safe: string; covered: string },
): string {
  const rect = (r: Rect, attrs: string) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${attrs}/>`;
  const overlay = [
    rect(spec.safe, `fill="none" stroke="${marks.safe}" stroke-width="2" stroke-dasharray="8 6"`),
    ...spec.covered.map((zone) => rect(zone, `fill="${marks.covered}" fill-opacity="0.3"`)),
    ...boxes.map((box) => rect(box, `fill="none" stroke="${marks.safe}" stroke-width="1"`)),
  ];
  return svg.replace(/<\/svg>$/, `${overlay.join('')}</svg>`);
}
