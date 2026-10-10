/**
 * Captures every product picture the site shows from the live demo, so the site always shows
 * the UI a visitor installs: each route in src/data/previews.ts at the preview viewport, and
 * the board at a phone's width for the phone poster, 2x, in the product's light and dark
 * themes (?theme=dark), saved to src/assets/previews/. The demo's banner is removed first,
 * since the demo framed on the homepage never shows it.
 *
 * Two sources, the same pictures:
 * - the built demo (dist/demo), served by Playwright itself, no port involved:
 *   `pnpm turbo run build --filter @bemmoly/site`, then `pnpm --filter @bemmoly/site previews`;
 * - a running demo build, such as `pnpm --filter @bemmoly/web exec vite --mode demo --port 5391`:
 *   `pnpm --filter @bemmoly/site previews -- --origin http://127.0.0.1:5391`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type Page } from '@playwright/test';
import { PHONE_POSTER, PREVIEW_VIEWPORT, PREVIEWS } from '../src/data/previews.ts';

const dist = new URL('../dist/', import.meta.url);
const out = new URL('../src/assets/previews/', import.meta.url);
const BUILT = 'http://demo.invalid';
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const THEMES = ['light', 'dark'] as const;

const { values } = parseArgs({ options: { origin: { type: 'string' } } });
const origin = values.origin?.replace(/\/$/, '') ?? BUILT;
if (origin === BUILT && !existsSync(new URL('demo/index.html', dist))) {
  throw new Error(
    'Build the site with its demo first (pnpm turbo run build --filter @bemmoly/site), or pass --origin',
  );
}
mkdirSync(out, { recursive: true });

/** The demo's files from dist, and its page for every route, as the Caddyfile serves them. */
async function serveBuilt(page: Page): Promise<void> {
  await page.route(`${BUILT}/**`, async (route, asked) => {
    const path = new URL(asked.url()).pathname;
    const file = new URL(`.${path}`, dist);
    const found = extname(path) !== '' && existsSync(file);
    await route.fulfill({
      body: readFileSync(found ? file : new URL('demo/index.html', dist)),
      contentType: TYPES[found ? extname(path) : '.html'] ?? 'application/octet-stream',
    });
  });
}

/** One context per theme and size, so a theme the demo remembers never leaks into the next. */
async function capture(
  browser: Browser,
  shot: { path: string; name: string; viewport: { width: number; height: number } },
  theme: (typeof THEMES)[number],
): Promise<void> {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  const page = await context.newPage();
  if (origin === BUILT) await serveBuilt(page);
  await page.goto(`${origin}${shot.path}?theme=${theme}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    document.getElementById('demo-banner')?.remove();
    delete document.documentElement.dataset['demoBanner'];
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const name = `${shot.name}${theme === 'dark' ? '-dark' : ''}.png`;
  await page.screenshot({ path: new URL(name, out).pathname });
  process.stdout.write(`${name}\n`);
  await context.close();
}

const browser = await chromium.launch();
const shots = [
  ...PREVIEWS.map((preview) => ({
    path: preview.path,
    name: preview.id,
    viewport: { ...PREVIEW_VIEWPORT },
  })),
  { path: PHONE_POSTER.path, name: PHONE_POSTER.id, viewport: { ...PHONE_POSTER.viewport } },
];
for (const theme of THEMES) {
  for (const shot of shots) await capture(browser, shot, theme);
}
await browser.close();
