/**
 * The Open Graph cards: the lockup, the tagline, a line about the product, the install
 * command and a framed slice of the Board mock, on the Classic page background. Every colour,
 * radius and shadow comes from the tokens; the text is outlined from the self-hosted fonts.
 */
import { readFileSync } from 'node:fs';
import { RADII, SHADOWS } from '../src/tokens.ts';
import { measure, outline, wrap, type TextStyle } from './outline-text.ts';

export interface PreviewInput {
  /** The -color lockup with its colours resolved. */
  lockup: string;
  colors: Record<'bg' | 'sf' | 'br' | 'tx' | 'tx2' | 'tx3' | 'ac', string>;
}

const HEADLINE = 'Your work. Your platform.';
const LINE = 'Open source, self-hosted, AI-first issues and docs for your whole company.';
const COMMAND = 'curl -fsSL https://get.bemmoly.com | sh';
const FOOTER = 'bemmoly.com  ·  MIT licensed';

const headline: TextStyle = { family: 'ibm-plex-sans', weight: 600, size: 64, tracking: -0.02 };
const body: TextStyle = { family: 'ibm-plex-sans', weight: 400, size: 26 };
const code: TextStyle = { family: 'ibm-plex-mono', weight: 400, size: 20 };
const footer: TextStyle = { family: 'ibm-plex-sans', weight: 400, size: 20 };

/** The Board shot the landing page shows (2x, light theme), recaptured from the mocks. */
const BOARD = new URL('../../../apps/site/src/assets/screens/board.png', import.meta.url);
const BOARD_SIZE = { width: 2364, height: 1372 };
const MARGIN = 72;
const LOCKUP_HEIGHT = 56;

const px = (value: string) => Number.parseFloat(value);

/** `0 1px 2px rgba(16,24,40,.05)` as an SVG drop shadow. */
function shadowFilter(id: string): string {
  const [x = '0', y = '0', blur = '0', ...rest] = SHADOWS.card.split(' ');
  const rgba = /rgba\(([^)]+)\)/.exec(rest.join(' '))?.[1]?.split(',') ?? [];
  const [r = '0', g = '0', b = '0', a = '1'] = rgba.map((part) => part.trim());
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="${px(x)}" dy="${px(y)}" stdDeviation="${px(blur) / 2}" flood-color="rgb(${r},${g},${b})" flood-opacity="${Number(a)}"/></filter>`;
}

const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function lockupAt(input: PreviewInput, x: number, y: number): string {
  const scale = LOCKUP_HEIGHT / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${inner(input.lockup)}</g>`;
}

/** The headline, the line under it and the command pill, from `top`; returns the svg and height. */
function copyBlock(input: PreviewInput, x: number, top: number, width: number) {
  const { colors } = input;
  // One sentence per line where they fit: the tagline reads as two beats.
  const titles = HEADLINE.split(/(?<=\.) /).flatMap((sentence) => wrap(sentence, headline, width));
  const lines = wrap(LINE, body, width);
  const parts: string[] = [];
  let y = top;
  for (const title of titles) {
    y += 64;
    parts.push(`<path fill="${colors.tx}" d="${outline(title, headline, x, y)}"/>`);
    y += 8;
  }
  y += 16;
  for (const line of lines) {
    y += 34;
    parts.push(`<path fill="${colors.tx2}" d="${outline(line, body, x, y - 8)}"/>`);
  }
  y += 28;
  const pillWidth = measure(COMMAND, code) + 40;
  parts.push(
    `<rect x="${x}" y="${y}" width="${pillWidth}" height="48" rx="${px(RADII.card)}" fill="${colors.sf}" stroke="${colors.br}"/>`,
    `<path fill="${colors.tx}" d="${outline(COMMAND, code, x + 20, y + 31)}"/>`,
  );
  y += 48;
  return { svg: parts.join(''), height: y - top };
}

/** A framed slice of the Board: the image is larger than the frame, which clips it. */
function boardFrame(
  input: PreviewInput,
  frame: { x: number; y: number; w: number; h: number },
  scale: number,
) {
  const image = readFileSync(BOARD).toString('base64');
  const radius = px(RADII.dialog);
  const w = BOARD_SIZE.width * scale;
  const h = BOARD_SIZE.height * scale;
  return [
    `<clipPath id="board"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="${radius}"/></clipPath>`,
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="${radius}" fill="${input.colors.sf}" filter="url(#shadow)"/>`,
    `<image clip-path="url(#board)" x="${frame.x}" y="${frame.y}" width="${w}" height="${h}" href="data:image/png;base64,${image}"/>`,
    `<rect x="${frame.x + 0.5}" y="${frame.y + 0.5}" width="${frame.w - 1}" height="${frame.h - 1}" rx="${radius}" fill="none" stroke="${input.colors.br}"/>`,
  ].join('');
}

function canvas(input: PreviewInput, width: number, height: number, content: string[]): string {
  const { colors } = input;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    `<radialGradient id="glow" cx="0" cy="0" r="${width * 0.7}" gradientUnits="userSpaceOnUse">`,
    `<stop offset="0" stop-color="${colors.ac}" stop-opacity="0.14"/>`,
    `<stop offset="1" stop-color="${colors.ac}" stop-opacity="0"/>`,
    '</radialGradient>',
    shadowFilter('shadow'),
    '</defs>',
    `<rect width="${width}" height="${height}" fill="${colors.bg}"/>`,
    `<rect width="${width}" height="${height}" fill="url(#glow)"/>`,
    ...content,
    '</svg>',
  ].join('');
}

/** 1200 x 630: brand and copy on the left, the Board bleeding off the right and bottom. */
export function wideCard(input: PreviewInput): string {
  const column = 620 - MARGIN - 48;
  const footerBaseline = 630 - MARGIN + 14;
  const space = { top: MARGIN + LOCKUP_HEIGHT, bottom: footerBaseline - 20 };
  const probe = copyBlock(input, MARGIN, 0, column);
  const top = space.top + (space.bottom - space.top - probe.height) / 2;
  return canvas(input, 1200, 630, [
    lockupAt(input, MARGIN, MARGIN),
    copyBlock(input, MARGIN, top, column).svg,
    `<path fill="${input.colors.tx3}" d="${outline(FOOTER, footer, MARGIN, footerBaseline)}"/>`,
    boardFrame(input, { x: 620, y: 150, w: 620, h: 520 }, 0.42),
  ]);
}

/** 1080 x 1080 for platforms that crop square: lockup, copy, then the Board at the bottom. */
export function squareCard(input: PreviewInput): string {
  const column = 1080 - MARGIN * 2;
  const copy = copyBlock(input, MARGIN, MARGIN + LOCKUP_HEIGHT + 56, column);
  const boardTop = MARGIN + LOCKUP_HEIGHT + 56 + copy.height + 72;
  const footerWidth = measure(FOOTER, footer);
  return canvas(input, 1080, 1080, [
    lockupAt(input, MARGIN, MARGIN),
    `<path fill="${input.colors.tx3}" d="${outline(FOOTER, footer, 1080 - MARGIN - footerWidth, MARGIN + 36)}"/>`,
    copy.svg,
    boardFrame(
      input,
      { x: MARGIN, y: boardTop, w: 1080 - MARGIN + 40, h: 1080 - boardTop + 40 },
      0.5,
    ),
  ]);
}
