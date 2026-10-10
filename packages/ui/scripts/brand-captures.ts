/**
 * Captures the product shots the social preview and the banners frame: the Board from the
 * demo build, at the homepage previews' viewport, 2x, in Classic and in Ocean (`?theme=ocean`),
 * saved to assets/brand/captures/. It follows apps/site/scripts/capture-previews.ts (same
 * viewport, the demo banner removed), but reads a running demo so it needs no site build:
 *
 *   pnpm --filter @bemmoly/web exec vite --mode demo --port 5431
 *   pnpm --filter @bemmoly/ui brand:captures [--url http://localhost:5431/demo]
 *   pnpm --filter @bemmoly/ui brand:icons
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const out = new URL('../assets/brand/captures/', import.meta.url);
const flag = process.argv.indexOf('--url');
const base = (flag === -1 ? 'http://localhost:5431/demo' : process.argv[flag + 1])?.replace(
  /\/$/,
  '',
);
if (!base) throw new Error('--url needs the demo address');

/** The homepage previews' viewport (apps/site/src/data/previews.ts). */
const VIEWPORT = { width: 1280, height: 744 };
const SHOTS = [{ name: 'board', path: '/work/board/PLT' }] as const;
const THEMES = [
  { suffix: '', query: '' },
  { suffix: '-ocean', query: '?theme=ocean' },
] as const;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    // A fresh page per theme: the demo reads ?theme once, when it creates its workspace.
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    for (const shot of SHOTS) {
      await page.goto(`${base}${shot.path}${theme.query}`, { waitUntil: 'networkidle' });
      // The board draws skeletons until the mock backend answers; wait for a real card.
      await page
        .getByText(/^PLT-\d+$/)
        .first()
        .waitFor();
      await page.evaluate(async () => {
        document.getElementById('demo-banner')?.remove();
        delete document.documentElement.dataset['demoBanner'];
        // The images outlive a release, so the sidebar's version line is left blank.
        for (const link of document.querySelectorAll<HTMLElement>('a[href$="/changelog"]')) {
          link.style.visibility = 'hidden';
        }
        await document.fonts.ready;
      });
      await page.waitForTimeout(600);
      const name = `${shot.name}${theme.suffix}.png`;
      await page.screenshot({ path: fileURLToPath(new URL(name, out)) });
      process.stdout.write(`${name}\n`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
