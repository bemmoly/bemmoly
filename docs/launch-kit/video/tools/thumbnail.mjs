// Renders thumbnail.html at 2× and writes the YouTube thumbnail.
//   node tools/thumbnail.mjs → out/thumbnail.png (2560 × 1440) and out/thumbnail.jpg (1280 × 720)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';

mkdirSync('out', { recursive: true });
const server = await serve(0);
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/thumbnail.html`);
await page.evaluate(() => window.__ready);
await page.screenshot({ path: 'out/thumbnail.png' });
await browser.close(); server.close();
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', 'out/thumbnail.png', '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', 'out/thumbnail.jpg']);
console.log('out/thumbnail.png · out/thumbnail.jpg');
