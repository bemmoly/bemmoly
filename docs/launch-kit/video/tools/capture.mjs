// Renders the film frame by frame in headless Chromium and encodes it with ffmpeg.
//   node tools/capture.mjs                       full film → out/bemmoly-launch.mp4
//   node tools/capture.mjs --from 25 --to 42     a range
//   node tools/capture.mjs --stills 1,4.5,9.8    PNG stills → out/stills/
//   --dir out/stills-x  where stills go
//   --max-ram 10        cap total memory (GB) of the browsers and encoders
//   --scale 2           device scale (2 = 4K frames, the default; 1 = fast 1080p drafts)
//   options: --fps 60 --workers 6 --out file.mp4 --audio out/score.wav
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { serve } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = Number(arg('fps', 60));
// Each worker is one headless browser plus one encoder, about 1–1.5 GB together at 4K.
// Each worker is one 4K browser (~1.5 GB) plus one encoder (~0.25 GB): 4 stays near 7 GB.
const WORKERS = Number(arg('workers', 4));
const OUT = arg('out', 'out/bemmoly-launch.mp4');
const AUDIO = arg('audio', null);
const STILLS = arg('stills', null);
const DIR = arg('dir', 'out/stills');
// Supersampling: 2 renders every frame at 3840 × 2160 (a 4K master; derive 1080p with ffmpeg).
const SCALE = Number(arg('scale', 2));
// Memory cap in GB for the whole render (browsers + encoders). Workers pause between frames
// while the total is over it, and resume once it drops.
const MAX_RAM_GB = Number(arg('max-ram', 10));
mkdirSync('out', { recursive: true });

const server = await serve(0);
const url = `http://127.0.0.1:${server.address().port}/?capture=1`;
// --run-all-compositor-stages-before-draw: finish rasterizing every tile before a frame is drawn,
// so a screenshot can never catch a half-painted page under load.
const LAUNCH = { args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--run-all-compositor-stages-before-draw', '--disable-checker-imaging'] };
// Seek, then let two frames go by so the new state has been committed and drawn.
const SEEK = (t) => { window.__film.seek(t); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
const browser = await chromium.launch(LAUNCH);

// Each render worker gets its own browser: pages in one browser share a compositor and queue.
async function openPage(b = browser) {
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.evaluate(() => window.__film.ready);
  return page;
}

if (STILLS) {
  mkdirSync(DIR, { recursive: true });
  const page = await openPage();
  for (const s of STILLS.split(',').map(Number)) {
    await page.evaluate(SEEK, s);
    const file = `${DIR}/t${s.toFixed(2).padStart(6, '0')}.png`;
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close(); server.close();
  process.exit(0);
}

const duration = await (await openPage()).evaluate(() => window.__film.DURATION);
const from = Number(arg('from', 0)), to = Number(arg('to', duration));
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
const total = f1 - f0;
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-threads', '2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-x264-params', 'rc-lookahead=12:threads=2', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  return ff;
}

// Total resident memory of this process tree, sampled every 2 s.
let ramGb = 0;
function sampleRam() {
  try {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const kids = new Map();
    for (const [pid, ppid] of rows) { if (!kids.has(ppid)) kids.set(ppid, []); kids.get(ppid).push(pid); }
    const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
    let total = 0;
    const stack = [process.pid];
    while (stack.length) { const p = stack.pop(); total += rss.get(p) || 0; stack.push(...(kids.get(p) || [])); }
    ramGb = total / 1048576;
  } catch { /* ps unavailable: no cap */ }
}
sampleRam();
const ramTimer = setInterval(sampleRam, 2000);
async function underCap() {
  let warned = false;
  while (ramGb > MAX_RAM_GB) {
    if (!warned) { console.warn(`memory ${ramGb.toFixed(1)} GB over the ${MAX_RAM_GB} GB cap, pausing`); warned = true; }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const parts = [];
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const a = f0 + w * per, b = Math.min(f1, a + per);
  if (a >= b) return;
  const file = `out/part-${process.pid}-${String(w).padStart(2, '0')}.mp4`;
  parts[w] = file;
  const own = await chromium.launch(LAUNCH);
  const page = await openPage(own);
  const ff = encoder(file);
  for (let f = a; f < b; f++) {
    await underCap();
    await page.evaluate(SEEK, f / FPS);
    // Under heavy load a 4K screenshot can stall; retry rather than lose the whole run.
    let buf;
    for (let tries = 0; !buf; tries++) {
      try { buf = await page.screenshot({ type: 'jpeg', quality: 95, timeout: 120000 }); }
      catch (e) { if (tries >= 3) throw e; console.warn(`frame ${f}: ${e.message.split('\n')[0]}, retrying`); await page.evaluate(SEEK, f / FPS); }
    }
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 120 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames · ${(done / el).toFixed(1)} fps · ~${Math.round((total - done) / (done / el))}s left · ${ramGb.toFixed(1)} GB`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await own.close();
}));
clearInterval(ramTimer);
await browser.close(); server.close();

const list = `out/parts-${process.pid}.txt`;
writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p.replace('out/', '')}'`).join('\n'));
const concatArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (AUDIO) concatArgs.push('-ss', String(from), '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
concatArgs.push('-c:v', 'copy', '-movflags', '+faststart', OUT);
await new Promise((r, j) => spawn('ffmpeg', concatArgs, { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('concat failed')) : r())));
for (const p of parts.filter(Boolean)) rmSync(p);
rmSync(list);
console.log(`${OUT} · ${total} frames in ${Math.round((Date.now() - started) / 1000)}s`);
