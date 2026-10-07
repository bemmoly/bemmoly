/**
 * One spec per platform banner. The zones are the platforms' own (see the Banners section of
 * assets/brand/README.md); composeBanner refuses a layout whose text strays into them.
 */
import type { TextStyle } from './outline-text.ts';
import type { BannerSpec } from './banner-layout.ts';

const sans = (size: number, weight: 400 | 600 = 400): TextStyle => ({
  family: 'ibm-plex-sans',
  weight,
  size,
  ...(weight === 600 ? { tracking: -0.02 } : {}),
});
const mono = (size: number): TextStyle => ({ family: 'ibm-plex-mono', weight: 400, size });

/**
 * X header, 1500 x 500. Phones crop the top and bottom to the central 360px band; on desktop
 * the avatar overlaps the bottom-left 420 x 420.
 */
const x: BannerSpec = {
  name: 'banner-x-1500x500',
  width: 1500,
  height: 500,
  scales: [1, 2],
  safe: { x: 0, y: 70, w: 1500, h: 360 },
  covered: [{ x: 0, y: 80, w: 420, h: 420 }],
  copy: {
    x: 480,
    width: 540,
    headline: sans(64, 600),
    split: true,
    body: sans(24),
    code: mono(20),
  },
  frame: { rect: { x: 1090, y: 116, w: 450, h: 424 }, scale: 0.42 },
  domain: { style: sans(18), right: 1440, baseline: 98 },
  glow: { cx: 420, cy: 0, r: 1050 },
};

/**
 * LinkedIn company page cover, 1128 x 191. The page logo overlaps about 270 x 140 at the
 * bottom-left on desktop and phones show only the middle, so text stays in the right
 * two-thirds, vertically centred. At this height the install pill would push the block out
 * of the band or squeeze the Board to a sliver, so the cover carries the tagline and the line
 * only, and the Board is cropped to its top bar and the first card column.
 */
const linkedinCompany: BannerSpec = {
  name: 'banner-linkedin-company-1128x191',
  width: 1128,
  height: 191,
  scales: [1],
  safe: { x: 376, y: 24, w: 728, h: 143 },
  covered: [{ x: 0, y: 51, w: 270, h: 140 }],
  copy: { x: 384, width: 560, headline: sans(48, 600), split: false, body: sans(18) },
  // From just before the top bar's Projects tab, so the slice opens on the first card column.
  frame: { rect: { x: 968, y: 48, w: 200, h: 183 }, scale: 0.33, from: { x: 352, y: 0 } },
  domain: { style: sans(14), right: 1104, baseline: 36 },
  glow: { cx: 376, cy: 0, r: 760 },
};

/**
 * LinkedIn personal profile banner, 1584 x 396. The profile photo overlaps about 400 x 300
 * at the bottom-left; text stays right of x 480.
 */
const linkedinPersonal: BannerSpec = {
  name: 'banner-linkedin-personal-1584x396',
  width: 1584,
  height: 396,
  scales: [1, 2],
  safe: { x: 480, y: 32, w: 1072, h: 332 },
  covered: [{ x: 0, y: 96, w: 400, h: 300 }],
  copy: {
    x: 520,
    width: 560,
    headline: sans(56, 600),
    split: true,
    body: sans(22),
    code: mono(18),
  },
  frame: { rect: { x: 1150, y: 88, w: 474, h: 348 }, scale: 0.4 },
  domain: { style: sans(16), right: 1528, baseline: 62 },
  glow: { cx: 480, cy: 0, r: 1100 },
};

/**
 * Buy Me a Coffee cover, 1600 x 400 (help.buymeacoffee.com, "How to set up your Buy Me a
 * Coffee page"). Measured on a live page: phones show the whole cover with the avatar centred
 * over x 587-1014 from y 157; desktop has no avatar on the cover but the page cards cover it
 * from about y 270 at the narrowest desktop width. Text stays above y 260, and left of the
 * avatar column below y 150.
 */
const buyMeACoffee: BannerSpec = {
  name: 'banner-buymeacoffee-1600x400',
  width: 1600,
  height: 400,
  scales: [1],
  safe: { x: 48, y: 24, w: 1504, h: 236 },
  covered: [
    { x: 587, y: 150, w: 427, h: 250 },
    { x: 0, y: 260, w: 1600, h: 140 },
  ],
  copy: {
    x: 80,
    width: 480,
    headlineWidth: 760,
    top: 32,
    headline: sans(64, 600),
    split: false,
    body: sans(22),
    code: mono(18),
  },
  frame: { rect: { x: 1090, y: 72, w: 550, h: 368 }, scale: 0.42 },
  domain: { style: sans(18), right: 1544, baseline: 50 },
  glow: { cx: 0, cy: 0, r: 1120 },
};

export const BANNERS: readonly BannerSpec[] = [x, linkedinCompany, linkedinPersonal, buyMeACoffee];

/**
 * The README hero, 1280 x 400. Nothing sits beside it, so it carries the lockup. GitHub shows
 * it about 900px wide (0.7x): 60px, 24px and 20px read there as about 42, 17 and 14.
 */
export const README_HERO: BannerSpec = {
  name: 'readme-hero',
  width: 1280,
  height: 400,
  scales: [1],
  safe: { x: 40, y: 32, w: 1200, h: 336 },
  covered: [],
  lockup: { x: 64, y: 52, height: 40 },
  copy: {
    x: 64,
    width: 600,
    headlineWidth: 700,
    top: 112,
    headline: sans(60, 600),
    split: false,
    body: sans(24),
    code: mono(20),
  },
  frame: { rect: { x: 800, y: 64, w: 520, h: 376 }, scale: 0.42 },
  glow: { cx: 0, cy: 0, r: 900 },
};
