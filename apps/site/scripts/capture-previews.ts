/**
 * Captures the homepage previews' posters from the built demo (dist/demo): each route in
 * src/data/previews.ts at the preview viewport, 2x, in Classic and in Ocean (?theme=ocean),
 * saved to src/assets/previews/. Playwright serves dist itself, so no server or port is
 * involved. Run after the demo changes: `pnpm turbo run build --filter @bemmoly/site`, then
 * `pnpm --filter @bemmoly/site previews`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { chromium } from '@playwright/test';
import { PREVIEW_VIEWPORT, PREVIEWS } from '../src/data/previews.ts';

const dist = new URL('../dist/', import.meta.url);
const out = new URL('../src/assets/previews/', import.meta.url);
const ORIGIN = 'http://demo.invalid';
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

if (!existsSync(new URL('demo/index.html', dist))) {
  throw new Error(
    'Build the site with its demo first: pnpm turbo run build --filter @bemmoly/site',
  );
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { ...PREVIEW_VIEWPORT },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
// The demo's files from dist, and its page for every route, as the Caddyfile serves them.
await page.route(`${ORIGIN}/**`, async (route, asked) => {
  const path = new URL(asked.url()).pathname;
  const file = new URL(`.${path}`, dist);
  const found = extname(path) !== '' && existsSync(file);
  await route.fulfill({
    body: readFileSync(found ? file : new URL('demo/index.html', dist)),
    contentType: TYPES[found ? extname(path) : '.html'] ?? 'application/octet-stream',
  });
});

for (const theme of ['', 'ocean']) {
  for (const preview of PREVIEWS) {
    await page.goto(`${ORIGIN}${preview.path}${theme ? `?theme=${theme}` : ''}`);
    await page.waitForLoadState('networkidle');
    // Framed on the homepage, the demo shows no banner; the poster must match that.
    await page.evaluate(() => {
      document.getElementById('demo-banner')?.remove();
      delete document.documentElement.dataset['demoBanner'];
    });
    await page.waitForTimeout(600);
    const name = `${preview.id}${theme ? `-${theme}` : ''}.png`;
    await page.screenshot({ path: new URL(name, out).pathname });
    process.stdout.write(`${name}\n`);
  }
}
await browser.close();
