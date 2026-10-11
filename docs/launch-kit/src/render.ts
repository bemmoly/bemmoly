/**
 * Builds every launch image from HTML and CSS templates (src/templates.ts) and renders each to
 * a PNG at its platform's exact size in docs/launch-kit/images/. The pictures inside are the
 * real product, captured from the demo by capture.ts into src/shots/.
 *
 *   pnpm --filter @bemmoly/web exec vite --mode demo --port 5500
 *   node docs/launch-kit/src/render.ts                 # capture the demo, then render
 *   node docs/launch-kit/src/render.ts --skip-capture  # render from the shots already captured
 *   node docs/launch-kit/src/render.ts --url http://localhost:5500/demo
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright.ts';
import { IMAGES, page as htmlPage } from './templates.ts';

if (!process.argv.includes('--skip-capture')) {
  const flag = process.argv.indexOf('--url');
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('./capture.ts', import.meta.url)),
      ...(flag === -1 ? [] : ['--url', process.argv[flag + 1]]),
    ],
    {
      stdio: 'inherit',
    },
  );
}

const out = fileURLToPath(new URL('../images/', import.meta.url));
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'bemmoly-launch-'));

const browser = await chromium.launch();
try {
  for (const image of IMAGES) {
    const file = join(scratch, `${image.id}.html`);
    writeFileSync(file, htmlPage(image));
    const page = await browser.newPage({
      viewport: { width: image.width, height: image.height },
      deviceScaleFactor: 1,
    });
    await page.goto(`file://${file}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, `${image.id}.png`) });
    process.stdout.write(`${image.id}.png ${image.width}x${image.height}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}

await import('./review.ts');
