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

type Layout = 'split' | 'stack' | 'banner' | 'thumb' | 'shotled' | 'install' | 'themes';

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
    id: 'x-header',
    platform: 'X',
    use: 'Profile header banner',
    width: 1500,
    height: 500,
    layout: 'banner',
    headline: 'Your work. Your platform.',
    shot: 'board',
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
    id: 'linkedin-cover',
    platform: 'LinkedIn',
    use: 'Company page cover',
    width: 1128,
    height: 191,
    layout: 'banner',
    headline: 'Your work. Your platform.',
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
    case 'banner':
      return `<div class="banner">
        <div class="copy"><div class="lockup">${LOCKUP}</div><h1>${image.headline}</h1>${promises()}</div>
        ${frame(image.shot!, 'banner-shot')}
      </div>`;
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

export function page(image: LaunchImage): string {
  const u =
    image.layout === 'banner' ? image.height / 520 : Math.min(image.width / 1600, image.height / 900);
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
/* banner: short and wide */
.banner .copy{position:absolute;left:5%;top:50%;transform:translateY(-50%);width:44%}
.banner h1{font-size:calc(var(--u)*72px)}
.banner .lockup+h1{margin-top:calc(var(--u)*28px)}
.banner .promises{flex-direction:row;flex-wrap:wrap;gap:calc(var(--u)*12px) calc(var(--u)*28px);margin-top:calc(var(--u)*28px)}
.banner .promises li{font-size:calc(var(--u)*26px)}
.banner-shot{left:56%;top:12%;width:calc(var(--u)*1180px);height:calc(var(--u)*686px)}
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
</style></head><body>${body(image)}</body></html>`;
}
