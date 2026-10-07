/**
 * Captures the product shots the landing page shows. The Landing mock embeds the Board and
 * Command mocks live inside two framed boxes; a static site needs pictures of them, so this
 * opens the Landing mock at 1280 wide, 2x, and saves the inside of each frame (inset by its
 * 1px border) as PNG, once as drawn and once in the Ocean preset for dark mode (see
 * ocean-mocks.ts). Astro's image pipeline turns them into AVIF and WebP at build time.
 * Run `pnpm --filter @bemmoly/site screens` after a mock changes and commit the result.
 */
import { chromium, type Browser } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { oceanVariant } from './ocean-mocks.ts';

const mocks = new URL('../../../docs/design/mocks/', import.meta.url);
const out = new URL('../src/assets/screens/', import.meta.url);

/** The frames in document order: the Board under the hero, the Command beside the AI copy. */
const FRAMES = ['board', 'command'] as const;
const VARIANTS = [
  { suffix: '', ocean: false },
  { suffix: '-ocean', ocean: true },
] as const;

let ocean = false;
// support.js fetches the embedded mocks, which browsers refuse over file://, so serve them.
const server = createServer((req, res) => {
  const file = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(1));
  readFile(new URL(file, mocks), 'utf8').then(
    (body) => {
      const type = file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
      res.writeHead(200, { 'content-type': type }).end(ocean ? oceanVariant(file, body) : body);
    },
    () => res.writeHead(404).end(),
  );
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;

async function capture(browser: Browser, suffix: string): Promise<void> {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/Bemmoly%20Landing.dc.html`, {
    waitUntil: 'networkidle',
  });
  const frames = page.locator('div[style*="aspect-ratio"]');
  for (const [index, name] of FRAMES.entries()) {
    const frame = frames.nth(index);
    await frame.scrollIntoViewIfNeeded();
    // The embedded mock renders into .sc-host after its own script loads.
    await frame.locator('.sc-host > *').first().waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const box = await frame.boundingBox();
    if (!box) throw new Error(`Frame ${index} of the Landing mock did not render.`);
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}${suffix}.png`, out)),
      clip: { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 },
    });
  }
  await page.close();
}

const browser = await chromium.launch();
try {
  for (const variant of VARIANTS) {
    ocean = variant.ocean;
    await capture(browser, variant.suffix);
  }
} finally {
  await browser.close();
  server.close();
}
