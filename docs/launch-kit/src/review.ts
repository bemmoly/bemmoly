/**
 * Writes docs/launch-kit/index.html: every image at its real size with its platform and size,
 * and each platform's post from posts.md beside it. Light and dark follow the system.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL, type LaunchImage, type Rect } from './templates.ts';

const kit = new URL('../', import.meta.url);
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** posts.md's "## Heading" sections by heading. */
const posts = new Map<string, string>();
for (const section of readFileSync(new URL('posts.md', kit), 'utf8').split(/^## /m).slice(1)) {
  const [title, ...rest] = section.split('\n');
  posts.set(title.trim(), rest.join('\n').replace(/\n---\s*$/, '').trim());
}

const GROUPS = [
  { platform: 'Brand', post: '' },
  { platform: 'X', post: 'X thread' },
  { platform: 'LinkedIn', post: 'LinkedIn' },
  { platform: 'Product Hunt', post: 'Product Hunt' },
  { platform: 'Reddit', post: 'r/selfhosted' },
  { platform: 'Hacker News', post: 'Show HN' },
];

/** The file an image is saved as, its real size, and how far its CSS px are scaled. */
function output(i: LaunchImage): { src: string; w: number; h: number; k: number } {
  const own = i.scales?.find((s) => s.as === i.id);
  const k = own?.scale ?? 1;
  const dir = i.brand ? '../../packages/ui/assets/brand/generated/' : 'images/';
  return { src: `${dir}${i.id}.png`, w: Math.round(i.width * k), h: Math.round(i.height * k), k };
}

const box = (r: Rect, k: number, cls: string): string =>
  `<span class="${cls}" style="left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px"></span>`;

function figure(i: LaunchImage): string {
  const o = output(i);
  const zones = [
    ...(i.safe ? [box(i.safe, o.k, 'safe')] : []),
    ...(i.covered ?? []).map((r) => box(r, o.k, 'covered')),
    ...(i.avatar
      ? [
          box({ x: i.avatar.x, y: i.avatar.y, w: i.avatar.size, h: i.avatar.size }, o.k, i.avatar.round ? 'avatar round' : 'avatar'),
        ]
      : []),
  ].join('');
  return `<figure>
  <figcaption><strong>${esc(i.use)}</strong><span>${o.w} × ${o.h}</span><a href="${esc(o.src)}">${esc(o.src.replace(/^(\.\.\/)+/, ''))}</a></figcaption>
  <div class="scroll"><div class="stage" style="width:${o.w}px"><img src="${esc(o.src)}" width="${o.w}" height="${o.h}" alt="${esc(`${i.platform} ${i.use}`)}">${zones}</div></div>
</figure>`;
}

const sections = GROUPS.map(({ platform, post }) => {
  const images = ALL.filter((i) => i.platform === platform)
    .map(figure)
    .join('\n');
  return `<section id="${platform.toLowerCase().replace(/\W+/g, '-')}">
<h2>${esc(platform)}</h2>
<div class="cols">
  <div class="images">${images || '<p class="none">No image: Show HN posts are text only.</p>'}</div>
  ${post ? `<aside><h3>${esc(post)}</h3><pre>${esc(posts.get(post) ?? '')}</pre></aside>` : '<aside><h3>Brand assets</h3><p>Profile banners, the README hero and the social previews, in <code>packages/ui/assets/brand/generated</code>. Turn on safe areas to see where each platform crops or covers: green is where text must stay, red is covered by the avatar or page logo, and the white shape is the avatar itself.</p></aside>'}
</div>
</section>`;
}).join('\n');

writeFileSync(
  new URL('index.html', kit),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bemmoly launch kit</title>
<style>
:root{--bg:#F6F7FA;--sf:#FFFFFF;--tx:#1B2430;--tx2:#5A6472;--line:#DDE2EA;--acc:#2356C9;color-scheme:light dark}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111418;--sf:#191D23;--tx:#E6E9EF;--tx2:#9AA3B2;--line:#2A3039;--acc:#7F98EC}}
:root[data-theme="dark"]{--bg:#111418;--sf:#191D23;--tx:#E6E9EF;--tx2:#9AA3B2;--line:#2A3039;--acc:#7F98EC}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif}
header,section{max-width:1960px;margin:0 auto;padding:24px 16px}
@media (min-width:768px){header,section{padding:32px 40px}}
h1{font-size:28px;margin:0 0 4px}
h2{font-size:22px;margin:0 0 16px;border-top:1px solid var(--line);padding-top:24px}
h3{font-size:15px;margin:0 0 8px}
header p{color:var(--tx2);margin:0;max-width:72ch}
nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:12px}
a{color:var(--acc)}
.cols{display:grid;gap:24px}
@media (min-width:1280px){.cols{grid-template-columns:minmax(0,1fr) 440px;align-items:start}}
.images{min-width:0;display:flex;flex-direction:column;gap:28px}
figure{margin:0;min-width:0}
figcaption{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin-bottom:8px;font-size:14px}
figcaption span{color:var(--tx2);font-variant-numeric:tabular-nums}
figcaption a{font-size:13px}
.scroll{overflow-x:auto;max-width:100%}
.scroll img{display:block;max-width:none;outline:1px solid var(--line)}
aside{background:var(--sf);border:1px solid var(--line);border-radius:10px;padding:16px;min-width:0}
@media (min-width:1280px){aside{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:13.5px/1.55 "IBM Plex Mono",ui-monospace,monospace}
.none{color:var(--tx2)}
.stage{position:relative}
.stage .safe,.stage .covered,.stage .avatar{position:absolute;display:none;pointer-events:none}
.stage .avatar{background:#fff;border:4px solid #fff;border-radius:12px;box-shadow:0 0 0 2px #DC2626}
.stage .avatar.round{border-radius:50%}
.stage .safe{outline:2px dashed #1F9D55;background:rgba(31,157,85,.08)}
.stage .covered{background:rgba(220,38,38,.28);outline:2px solid #DC2626}
body.zones .stage .safe,body.zones .stage .covered,body.zones .stage .avatar{display:block}
label.toggle{display:inline-flex;gap:8px;align-items:center;margin-top:12px;font-weight:500}
</style>
</head>
<body>
<header>
<h1>Bemmoly launch kit</h1>
<p>Every launch image and brand social asset at its real size, labelled with its platform and pixel size, beside the post it goes with. Images are rendered from <code>src/</code> with <code>node docs/launch-kit/src/render.ts</code>; the copy is <a href="posts.md">posts.md</a>.</p>
<label class="toggle"><input type="checkbox" id="zones"> Show safe areas</label>
<nav>${GROUPS.map((g) => `<a href="#${g.platform.toLowerCase().replace(/\W+/g, '-')}">${esc(g.platform)}</a>`).join('')}</nav>
</header>
${sections}
<script>
document.getElementById('zones').addEventListener('change', (e) => document.body.classList.toggle('zones', e.target.checked));
</script>
</body>
</html>
`,
);
process.stdout.write('index.html\n');
