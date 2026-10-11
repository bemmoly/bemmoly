/**
 * The launch images as data plus four HTML layouts. Colours are the logo's (brand.md: brand-1
 * #2356C9 for Work and the light accent, brand-2 #5B7BE5 for Docs, brand-3 #9A85EA for AI and
 * only AI) on the product's light surfaces; the logo is inlined from the brand files, never
 * redrawn. Every picture is a real capture from the demo (src/shots).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const brand = (file: string): string =>
  readFileSync(new URL(`packages/ui/assets/brand/${file}`, root), 'utf8')
    .replace(/ width="[\d.]+" height="[\d.]+"/, '')
    .replace(/style="fill: var\(--[\w-]+, (#\w+)\)"/g, 'fill="$1"');
const font = (pkg: string, file: string): string =>
  new URL(`packages/ui/node_modules/@fontsource/${pkg}/files/${file}`, root).href;
const shot = (name: string): string => new URL(`./shots/${name}.png`, import.meta.url).href;

const LOCKUP = brand('lockup-color.svg');
const LOCKUP_LIGHT = brand('lockup-light.svg');
const MARK = brand('mark-color.svg');

export const PROMISES = ['100% open source', 'No pricing', 'No in-app purchases'] as const;

type Layout = 'split' | 'stack' | 'cover' | 'thumb' | 'shotled' | 'install' | 'themes';

export interface LaunchImage {
  id: string;
  platform: string;
  use: string;
  width: number;
  height: number;
  layout: Layout;
  kicker?: string;
  headline?: string;
  sub?: string;
  shot?: string;
  /** A second picture, laid over the first (themes) or beside it. */
  inset?: string;
  /** Lilac kicker: AI only. */
  ai?: boolean;
  /** Brand assets render into packages/ui/assets/brand/generated, the rest into images/. */
  brand?: boolean;
  /** Extra renders at these device scales, saved as `<id>@<n>x.png` (or `as` when given). */
  scales?: { scale: number; as?: string }[];
  dark?: boolean;
  /** Where text must stay, and what the platform covers (its avatar or page logo). */
  safe?: Rect;
  covered?: Rect[];
  /** The platform's avatar or page logo, drawn on the review page and the profile mock. */
  avatar?: { x: number; y: number; size: number; round: boolean };
  cover?: Cover;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A banner: words inside the safe zone, a tilted glimpse of the product beside them. */
interface Cover {
  copy: { x: number; width: number; h1: number; line?: number; promise: number; top?: number };
  lockup?: number;
  glimpse: { x: number; y: number; w: number; h: number; rotate: number; zoom: number; from: [number, number] };
  /** "bemmoly.com" above the headline, at this size: banners with no lockup name it here. */
  domain?: number;
}

const HERO = 'Issues and docs on your own server';

export const IMAGES: LaunchImage[] = [
  {
    id: 'x-post-1-hero',
    platform: 'X',
    use: 'Post image (thread opener)',
    width: 1600,
    height: 900,
    layout: 'split',
    headline: HERO,
    sub: 'Boards, sprints and docs in one app. One command to install.',
    shot: 'board',
  },
  {
    id: 'x-post-2-docs',
    platform: 'X',
    use: 'Post image (Docs)',
    width: 1600,
    height: 900,
    layout: 'stack',
    kicker: 'Work and Docs',
    headline: 'Specs next to the issues they explain',
    shot: 'docs',
  },
  {
    id: 'x-post-3-ai',
    platform: 'X',
    use: 'Post image (AI)',
    width: 1600,
    height: 900,
    layout: 'split',
    kicker: 'Optional AI',
    ai: true,
    headline: 'Summaries that cite their sources',
    sub: 'Off until an admin turns it on. Your provider or a local model.',
    shot: 'issue',
    inset: 'ai-summary',
  },
  {
    id: 'linkedin-post',
    platform: 'LinkedIn',
    use: 'Post image',
    width: 1200,
    height: 627,
    layout: 'split',
    headline: HERO,
    shot: 'board',
  },
  {
    id: 'linkedin-square',
    platform: 'LinkedIn',
    use: 'Square post image',
    width: 1200,
    height: 1200,
    layout: 'stack',
    headline: HERO,
    shot: 'board',
  },
  {
    id: 'producthunt-thumbnail',
    platform: 'Product Hunt',
    use: 'Thumbnail',
    width: 240,
    height: 240,
    layout: 'thumb',
  },
  {
    id: 'producthunt-1-promise',
    platform: 'Product Hunt',
    use: 'Gallery 1: the promise',
    width: 1270,
    height: 760,
    layout: 'split',
    headline: HERO,
    sub: 'Open source, with nothing to buy. Ever.',
    shot: 'board',
  },
  {
    id: 'producthunt-2-work',
    platform: 'Product Hunt',
    use: 'Gallery 2: Work',
    width: 1270,
    height: 760,
    layout: 'stack',
    kicker: 'Work',
    headline: 'Boards, backlog, sprints, your workflows',
    shot: 'backlog',
  },
  {
    id: 'producthunt-3-docs',
    platform: 'Product Hunt',
    use: 'Gallery 3: Docs',
    width: 1270,
    height: 760,
    layout: 'stack',
    kicker: 'Docs',
    headline: 'Write together, linked to live issues',
    shot: 'docs',
  },
  {
    id: 'producthunt-4-ai',
    platform: 'Product Hunt',
    use: 'Gallery 4: AI',
    width: 1270,
    height: 760,
    layout: 'split',
    kicker: 'Optional AI',
    ai: true,
    headline: 'Answers with sources, off by default',
    sub: 'Bring your own provider or a model on your network.',
    shot: 'issue',
    inset: 'ai-summary',
  },
  {
    id: 'producthunt-5-install',
    platform: 'Product Hunt',
    use: 'Gallery 5: self-hosting',
    width: 1270,
    height: 760,
    layout: 'install',
    kicker: 'Self-hosting',
    headline: 'One command on your server',
  },
  {
    id: 'producthunt-6-themes',
    platform: 'Product Hunt',
    use: 'Gallery 6: themes and branding',
    width: 1270,
    height: 760,
    layout: 'themes',
    kicker: 'Appearance',
    headline: 'Five themes, light and dark, and your logo',
    shot: 'appearance',
    inset: 'board-pine-dark',
  },
  {
    id: 'reddit-selfhosted',
    platform: 'Reddit',
    use: 'r/selfhosted post image',
    width: 1920,
    height: 1080,
    layout: 'shotled',
    shot: 'board',
  },
];

const CHECK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const promises = (): string =>
  `<ul class="promises">${PROMISES.map((p) => `<li><span class="tick">${CHECK}</span>${p}</li>`).join('')}</ul>`;

const kicker = (image: LaunchImage): string =>
  image.kicker ? `<p class="kicker${image.ai ? ' ai' : ''}">${image.kicker}</p>` : '';

const frame = (name: string, cls = ''): string =>
  `<div class="window ${cls}"><img src="${shot(name)}" alt=""></div>`;

function body(image: LaunchImage): string {
  switch (image.layout) {
    case 'thumb':
      return `<div class="thumb">${MARK}</div>`;
    case 'cover':
      return cover(image);
    case 'split':
      return `<div class="split">
        <div class="copy"><div class="lockup">${LOCKUP}</div>${kicker(image)}<h1>${image.headline}</h1>
          ${image.sub ? `<p class="sub">${image.sub}</p>` : ''}${promises()}</div>
        ${frame(image.shot!, 'split-shot')}
        ${image.inset ? frame(image.inset, 'inset') : ''}
      </div>`;
    case 'stack':
      return `<div class="stack">
        <div class="head"><div class="lockup">${LOCKUP}</div>${kicker(image)}<h1>${image.headline}</h1>${promises()}</div>
        ${frame(image.shot!, 'stack-shot')}
      </div>`;
    case 'themes':
      return `<div class="stack">
        <div class="head"><div class="lockup">${LOCKUP}</div>${kicker(image)}<h1>${image.headline}</h1>${promises()}</div>
        ${frame(image.shot!, 'stack-shot themes-a')}
        ${frame(image.inset!, 'themes-b')}
      </div>`;
    case 'install':
      return `<div class="install">
        <div class="copy"><div class="lockup">${LOCKUP}</div>${kicker(image)}<h1>${image.headline}</h1>${promises()}</div>
        <div class="terminal" data-theme="dark">
          <div class="bar"><i></i><i></i><i></i></div>
          <pre><span class="dim">$</span> curl -fsSL https://get.bemmoly.com | sh</pre>
          <ul class="facts">
            <li>One Docker image and one Postgres</li>
            <li>Automatic HTTPS with Caddy</li>
            <li>Nightly backups, verified weekly</li>
            <li>Updates from the app that roll back if unhealthy</li>
            <li>Signed images, no telemetry</li>
          </ul>
          <div class="lockup light">${LOCKUP_LIGHT}</div>
        </div>
      </div>`;
    case 'shotled':
      return `<div class="shotled">
        ${frame(image.shot!, 'led-shot')}
        <div class="strip"><div class="lockup">${LOCKUP}</div><h1>Self-hosted issues and docs</h1>${promises()}</div>
      </div>`;
  }
}

const px = (n: number): string => `${Math.round(n * 10) / 10}px`;

function cover(image: LaunchImage): string {
  const c = image.cover!;
  const safe = image.safe ?? { x: 0, y: 0, w: image.width, h: image.height };
  const g = c.glimpse;
  // The capture is 1280 x 744 CSS px; `zoom` is its drawn width, `from` the top-left fraction shown.
  const zh = (c.glimpse.zoom * 744) / 1280;
  const copy = `<div class="cover-copy" style="left:${px(c.copy.x)};width:${px(c.copy.width)};top:${px(c.copy.top ?? safe.y)};height:${px(c.copy.top === undefined ? safe.h : image.height)};justify-content:${c.copy.top === undefined ? 'center' : 'flex-start'}">
    ${c.lockup ? `<div class="lockup" style="--lh:${px(c.lockup)}">${LOCKUP}</div>` : ''}
    ${c.domain ? `<p class="domain" style="font-size:${px(c.domain)}">bemmoly.com</p>` : ''}
    <h1 style="font-size:${px(c.copy.h1)}">${image.headline}</h1>
    ${image.sub && c.copy.line ? `<p class="line" style="font-size:${px(c.copy.line)}">${image.sub}</p>` : ''}
    <ul class="promises row" style="font-size:${px(c.copy.promise)}">${PROMISES.map((p) => `<li><span class="tick">${CHECK}</span>${p}</li>`).join('')}</ul>
  </div>`;
  const glimpse = `<div class="glimpse" style="left:${px(g.x)};top:${px(g.y)};width:${px(g.w)};height:${px(g.h)};transform:rotate(${g.rotate}deg);background-image:url(${shot(image.shot!)});background-size:${px(g.zoom)} ${px(zh)};background-position:${px(-g.from[0] * g.zoom)} ${px(-g.from[1] * zh)}"></div>`;
  return `${glimpse}${copy}`;
}

export function page(image: LaunchImage): string {
  const u = Math.min(image.width / 1600, image.height / 900);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:400;src:url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2')})}
@font-face{font-family:Plex;font-weight:500;src:url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-500-normal.woff2')})}
@font-face{font-family:Plex;font-weight:600;src:url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2')})}
@font-face{font-family:PlexMono;font-weight:500;src:url(${font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2')})}
:root{--u:${u};--b1:#2356C9;--b2:#5B7BE5;--b3:#9A85EA;--tx:#1B2430;--tx2:#4A5464;--line:#DDE2EA;--bg:#F6F7FA}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${image.width}px;height:${image.height}px;overflow:hidden}
body{font-family:Plex,sans-serif;color:var(--tx);position:relative;
  background:radial-gradient(120% 90% at 100% 0%,#E6ECFB 0%,rgba(230,236,251,0) 55%),radial-gradient(80% 70% at 0% 100%,#EEF1F8 0%,rgba(238,241,248,0) 60%),var(--bg)}
.lockup svg{height:calc(var(--u)*44px);width:auto;color:var(--tx);display:block}
h1{font-weight:600;letter-spacing:-0.02em;line-height:1.06;font-size:calc(var(--u)*80px)}
.kicker{font-weight:600;color:var(--b1);font-size:calc(var(--u)*28px);margin-top:calc(var(--u)*44px)}
.kicker.ai{color:#6F57D9}
.kicker+h1{margin-top:calc(var(--u)*10px)}
.lockup+h1{margin-top:calc(var(--u)*48px)}
.sub{color:var(--tx2);font-size:calc(var(--u)*30px);line-height:1.35;margin-top:calc(var(--u)*24px)}
.promises{list-style:none;display:flex;flex-direction:column;gap:calc(var(--u)*14px);margin-top:calc(var(--u)*40px)}
.promises li{display:flex;align-items:center;gap:calc(var(--u)*14px);font-weight:500;font-size:calc(var(--u)*30px)}
.tick{width:calc(var(--u)*34px);height:calc(var(--u)*34px);border-radius:50%;background:var(--b1);color:#fff;display:grid;place-items:center;flex:none}
.tick svg{width:62%;height:62%}
.window{position:absolute;background:#fff;border:1px solid var(--line);border-radius:calc(var(--u)*18px);overflow:hidden;
  box-shadow:0 calc(var(--u)*30px) calc(var(--u)*80px) rgba(27,36,48,.16),0 2px 6px rgba(27,36,48,.06)}
.window img{display:block;width:100%;height:100%;object-fit:cover;object-position:left top}
/* split: copy left, the product right, bleeding off the edge */
.split .copy{position:absolute;left:calc(var(--u)*88px);top:calc(var(--u)*88px);width:38%}
.split-shot{left:47%;top:calc(var(--u)*110px);width:calc(var(--u)*1180px);height:calc(var(--u)*686px)}
.inset{left:40%;bottom:calc(var(--u)*70px);width:calc(var(--u)*760px);height:auto;border-color:#D9D0F7;
  box-shadow:0 calc(var(--u)*24px) calc(var(--u)*60px) rgba(111,87,217,.22)}
.inset img{height:auto}
/* stack: words on top, the product below */
.stack .head{position:absolute;left:calc(var(--u)*88px);right:calc(var(--u)*88px);top:calc(var(--u)*72px)}
.stack .head .lockup{position:absolute;right:0;top:0}
.stack .head .kicker{margin-top:0}
.stack .head .lockup+h1{margin-top:0}
.stack .head h1{max-width:72%;font-size:calc(var(--u)*68px)}
.stack .head .promises{flex-direction:row;gap:calc(var(--u)*36px);margin-top:calc(var(--u)*26px)}
.stack .head .promises li{font-size:calc(var(--u)*26px)}
.stack-shot{left:calc(var(--u)*88px);right:calc(var(--u)*88px);top:calc(var(--u)*370px);bottom:calc(var(--u)*-60px)}
.themes-a{right:calc(var(--u)*420px)}
.themes-b{width:calc(var(--u)*720px);height:calc(var(--u)*420px);right:calc(var(--u)*88px);bottom:calc(var(--u)*60px)}
/* cover: banners, words in the safe zone and a tilted glimpse of the product */
.cover-copy{position:absolute;display:flex;flex-direction:column;z-index:2}
.cover-copy .lockup svg{height:var(--lh)}
.cover-copy .lockup{margin-bottom:.9em}
.cover-copy h1{letter-spacing:-0.02em;line-height:1.08}
.cover-copy .line{color:var(--tx2);margin-top:.35em;line-height:1.3}
.promises.row{flex-direction:row;flex-wrap:wrap;gap:.45em 1.1em;margin-top:.9em}
.promises.row li{font-size:1em;gap:.45em}
.promises.row .tick{width:1.2em;height:1.2em}
.glimpse{position:absolute;border-radius:14px;border:1px solid var(--line);background-color:#fff;background-repeat:no-repeat;
  box-shadow:0 24px 70px rgba(27,36,48,.18),0 2px 6px rgba(27,36,48,.06);transform-origin:left top}
.domain{color:var(--b1);font-weight:600;margin-bottom:.5em}
body.dark{--tx:#E6E9EF;--tx2:#9AA3B2;--line:#2A3039;--bg:#111418;--b1:#5B7BE5;
  background:radial-gradient(120% 90% at 100% 0%,#1A2238 0%,rgba(26,34,56,0) 55%),var(--bg)}
body.dark .glimpse{background-color:#111418;box-shadow:0 24px 70px rgba(0,0,0,.5)}
/* thumbnail: the mark alone */
.thumb{position:absolute;inset:0;display:grid;place-items:center;background:#fff}
.thumb svg{width:64%;height:auto}
/* install: a dark island for the terminal */
.install .copy{position:absolute;left:calc(var(--u)*88px);top:calc(var(--u)*88px);width:40%}
.terminal{position:absolute;right:calc(var(--u)*72px);top:calc(var(--u)*90px);bottom:calc(var(--u)*90px);width:50%;
  background:#111418;color:#E6E9EF;border-radius:calc(var(--u)*18px);padding:calc(var(--u)*30px) calc(var(--u)*40px);
  box-shadow:0 calc(var(--u)*30px) calc(var(--u)*80px) rgba(17,20,24,.3)}
.terminal .bar{display:flex;gap:8px;margin-bottom:calc(var(--u)*36px)}
.terminal .bar i{width:calc(var(--u)*14px);height:calc(var(--u)*14px);border-radius:50%;background:#2A3039}
.terminal pre{font-family:PlexMono,monospace;font-size:calc(var(--u)*25px);white-space:pre-wrap;color:#fff}
.terminal .dim{color:#7B8494}
.facts{list-style:none;margin-top:calc(var(--u)*40px);display:flex;flex-direction:column;gap:calc(var(--u)*16px);
  font-size:calc(var(--u)*25px);color:#C4CAD4}
.facts li{padding-left:calc(var(--u)*26px);position:relative}
.facts li::before{content:"";position:absolute;left:0;top:.5em;width:calc(var(--u)*10px);height:calc(var(--u)*10px);border-radius:2px;background:var(--b2)}
.terminal .lockup{position:absolute;left:calc(var(--u)*40px);bottom:calc(var(--u)*30px)}
.terminal .lockup svg{height:calc(var(--u)*30px)}
/* screenshot-led: the product first, a strip of words under it */
.led-shot{left:calc(var(--u)*56px);right:calc(var(--u)*56px);top:calc(var(--u)*48px);bottom:calc(var(--u)*150px)}
.strip{position:absolute;left:calc(var(--u)*72px);right:calc(var(--u)*72px);bottom:calc(var(--u)*40px);height:calc(var(--u)*70px);
  display:flex;align-items:center;gap:calc(var(--u)*40px)}
.strip .lockup svg{height:calc(var(--u)*36px)}
.strip h1{font-size:calc(var(--u)*36px);flex:1}
.strip .promises{flex-direction:row;margin:0;gap:calc(var(--u)*28px)}
.strip .promises li{font-size:calc(var(--u)*26px)}
.strip .tick{width:calc(var(--u)*28px);height:calc(var(--u)*28px)}
</style></head><body class="${image.dark ? 'dark' : ''}">${body(image)}</body></html>`;
}

const BRAND_LINE = 'Self-hosted issues and docs.';
const TAGLINE = 'Your work. Your platform.';

const README_COVER: Cover = {
  lockup: 40,
  copy: { x: 64, width: 640, h1: 58, line: 26, promise: 22 },
  glimpse: { x: 760, y: 70, w: 620, h: 420, rotate: -3, zoom: 1100, from: [0.2, 0.08] },
};

const LINKEDIN_COMPANY_COVER: Cover = {
  copy: { x: 300, width: 540, h1: 34, promise: 15 },
  glimpse: { x: 860, y: 34, w: 330, h: 200, rotate: -3, zoom: 760, from: [0.33, 0.13] },
  domain: 13,
};

/**
 * The brand's social assets (packages/ui/assets/brand/generated). Profile banners carry no
 * lockup: the platform shows the mark as the avatar beside them, so "bemmoly.com" names it.
 * Safe zones are the platforms' own; see packages/ui/assets/brand/README.md.
 */
export const BRAND: LaunchImage[] = [
  {
    id: 'social-preview',
    platform: 'Brand',
    use: 'og:image and twitter:image for bemmoly.com',
    width: 1200,
    height: 630,
    layout: 'split',
    brand: true,
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
  },
  {
    id: 'social-preview-square',
    platform: 'Brand',
    use: 'Square social preview',
    width: 1080,
    height: 1080,
    layout: 'stack',
    brand: true,
    headline: TAGLINE,
    shot: 'board',
  },
  {
    id: 'github-social-preview-1280x640',
    platform: 'Brand',
    use: 'GitHub repository social preview (upload the 2560 x 1280 file)',
    width: 1280,
    height: 640,
    layout: 'split',
    brand: true,
    scales: [{ scale: 2, as: 'github-social-preview-UPLOAD-2560x1280' }],
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
    safe: { x: 40, y: 40, w: 1200, h: 560 },
  },
  {
    id: 'readme-hero',
    platform: 'Brand',
    use: 'README hero, light',
    width: 1280,
    height: 400,
    layout: 'cover',
    brand: true,
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
    cover: README_COVER,
  },
  {
    id: 'readme-hero-dark',
    platform: 'Brand',
    use: 'README hero, dark (shown under dark mode)',
    width: 1280,
    height: 400,
    layout: 'cover',
    brand: true,
    dark: true,
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board-dark',
    cover: README_COVER,
  },
  {
    id: 'banner-x-1500x500',
    platform: 'Brand',
    use: 'X profile header (upload the 3000 x 1000 file)',
    width: 1500,
    height: 500,
    layout: 'cover',
    brand: true,
    scales: [{ scale: 2, as: 'x-header-UPLOAD-3000x1000' }],
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
    // The avatar covers the bottom-left (about 32% wide, 45% high, a 134px circle on desktop) and
    // phones crop about 60px off the top and bottom, so the words sit top-right of the avatar
    // and the product glimpse takes the left, where the avatar may cover it.
    safe: { x: 560, y: 60, w: 900, h: 380 },
    covered: [{ x: 0, y: 275, w: 480, h: 225 }],
    avatar: { x: 15, y: 363, size: 134, round: true },
    cover: {
      copy: { x: 600, width: 860, h1: 60, line: 26, promise: 23, top: 92 },
      glimpse: { x: -60, y: 40, w: 560, h: 420, rotate: -3, zoom: 1180, from: [0.29, 0.09] },
      domain: 20,
    },
  },
  {
    id: 'banner-linkedin-company-1128x191',
    platform: 'Brand',
    use: 'LinkedIn company page cover',
    width: 1128,
    height: 191,
    layout: 'cover',
    brand: true,
    scales: [{ scale: 3, as: 'linkedin-cover-UPLOAD-3384x573' }],
    headline: TAGLINE,
    shot: 'board',
    // The page logo covers about 270 x 140 at the bottom-left on desktop; phones keep the middle.
    safe: { x: 290, y: 20, w: 560, h: 151 },
    covered: [{ x: 0, y: 51, w: 270, h: 140 }],
    avatar: { x: 24, y: 95, size: 120, round: false },
    cover: LINKEDIN_COMPANY_COVER,
  },
  {
    id: 'linkedin-cover-UPLOAD-4200x700',
    platform: 'Brand',
    use: 'LinkedIn company cover: the file to upload (rendered at 1128 x 188, 3.72x)',
    width: 1128,
    height: 188,
    layout: 'cover',
    brand: true,
    scales: [{ scale: 4200 / 1128, as: 'linkedin-cover-UPLOAD-4200x700' }],
    headline: TAGLINE,
    shot: 'board',
    safe: { x: 290, y: 20, w: 560, h: 148 },
    covered: [{ x: 0, y: 50, w: 270, h: 138 }],
    avatar: { x: 24, y: 93, size: 120, round: false },
    cover: LINKEDIN_COMPANY_COVER,
  },
  {
    id: 'banner-linkedin-personal-1584x396',
    platform: 'Brand',
    use: 'LinkedIn personal profile background',
    width: 1584,
    height: 396,
    layout: 'cover',
    brand: true,
    scales: [{ scale: 2 }],
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
    safe: { x: 470, y: 32, w: 640, h: 332 },
    covered: [{ x: 0, y: 96, w: 400, h: 300 }],
    avatar: { x: 40, y: 200, size: 300, round: true },
    cover: {
      copy: { x: 480, width: 620, h1: 50, line: 22, promise: 20 },
      glimpse: { x: 1150, y: 70, w: 560, h: 420, rotate: -3, zoom: 1120, from: [0.29, 0.09] },
      domain: 18,
    },
  },
  {
    id: 'banner-buymeacoffee-1600x400',
    platform: 'Brand',
    use: 'Buy Me a Coffee page cover',
    width: 1600,
    height: 400,
    layout: 'cover',
    brand: true,
    headline: TAGLINE,
    sub: BRAND_LINE,
    shot: 'board',
    // Phones centre the avatar over x 587-1014 from y 150; desktop cards cover from y 260.
    safe: { x: 48, y: 24, w: 1504, h: 236 },
    covered: [
      { x: 587, y: 150, w: 427, h: 250 },
      { x: 0, y: 260, w: 1600, h: 140 },
    ],
    cover: {
      copy: { x: 80, width: 900, h1: 46, promise: 18, top: 28 },
      domain: 18,
      glimpse: { x: 1080, y: 60, w: 600, h: 420, rotate: -3, zoom: 1180, from: [0.29, 0.09] },
    },
  },
];

/** Launch-kit images and the brand assets, in render order. */
export const ALL: LaunchImage[] = [...IMAGES, ...BRAND];
