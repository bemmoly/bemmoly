/**
 * Captures the real product from a running demo build into src/shots/, 3x, with the demo
 * banner removed and the sidebar's version line hidden, so a picture never names a release:
 *
 *   pnpm --filter @bemmoly/web exec vite --mode demo --port 5500
 *   node docs/launch-kit/src/capture.ts [--url http://localhost:5500/demo]
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright.ts';

const flag = process.argv.indexOf('--url');
const base = (flag === -1 ? 'http://localhost:5500/demo' : process.argv[flag + 1]).replace(
  /\/$/,
  '',
);
const out = new URL('./shots/', import.meta.url);
mkdirSync(out, { recursive: true });

/** "RFC: Move sessions to Postgres" in the demo's Engineering space. */
const RFC_PAGE = '/docs/p/018f0000-0000-7000-8000-0000000013ed';

interface Shot {
  name: string;
  path: string;
  mode: 'light' | 'dark';
  theme?: string;
  /** Crop to this element, with a little of the page around it. */
  selector?: string;
}

const SHOTS: Shot[] = [
  { name: 'board', path: '/work/board/PLT', mode: 'light' },
  { name: 'board-dark', path: '/work/board/PLT', mode: 'dark' },
  { name: 'board-sand', path: '/work/board/PLT', mode: 'light', theme: 'sand' },
  { name: 'board-pine-dark', path: '/work/board/PLT', mode: 'dark', theme: 'pine' },
  { name: 'issue', path: '/work/issue/PLT-204', mode: 'light' },
  { name: 'docs', path: RFC_PAGE, mode: 'light' },
  { name: 'backlog', path: '/work/backlog/PLT', mode: 'light' },
  { name: 'appearance', path: '/settings/appearance', mode: 'light' },
  {
    name: 'ai-summary',
    path: '/work/issue/PLT-204',
    mode: 'light',
    selector: 'section[aria-label="AI summary"]',
  },
];

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 744 },
      deviceScaleFactor: 3,
      reducedMotion: 'reduce',
      colorScheme: shot.mode,
    });
    const page = await context.newPage();
    await page.goto(`${base}${shot.path}?theme=${shot.theme ?? 'bemmoly'}&mode=${shot.mode}`, {
      waitUntil: 'networkidle',
    });
    await page
      .waitForFunction(() => document.querySelector('[aria-busy="true"]') === null, null, {
        timeout: 8000,
      })
      .catch(() => process.stdout.write(`still loading after 8s: ${shot.path}\n`));
    await page.evaluate(async () => {
      document.getElementById('demo-banner')?.remove();
      delete document.documentElement.dataset['demoBanner'];
      for (const link of document.querySelectorAll<HTMLElement>('a[href$="/changelog"]')) {
        link.style.visibility = 'hidden';
      }
      await document.fonts.ready;
    });
    await page.waitForTimeout(800);
    const path = fileURLToPath(new URL(`${shot.name}.png`, out));
    if (shot.selector) {
      const box = await page.locator(shot.selector).first().boundingBox();
      if (!box) throw new Error(`${shot.selector} is not on ${shot.path}`);
      const m = 16;
      await page.screenshot({
        path,
        clip: { x: box.x - m, y: box.y - m, width: box.width + m * 2, height: box.height + m * 2 },
      });
    } else {
      await page.screenshot({ path });
    }
    process.stdout.write(`${shot.name}.png\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
