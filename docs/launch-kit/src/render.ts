/**
 * The one generator for Bemmoly's social images: the launch kit (docs/launch-kit/images) and
 * the brand's banners and social previews (packages/ui/assets/brand/generated). Each is an
 * HTML/CSS template (src/templates.ts) rendered to a PNG at its platform's exact size, around
 * real captures of the demo (capture.ts, into src/shots). It then writes the review page.
 *
 *   pnpm --filter @bemmoly/web exec vite --mode demo --port 5500
 *   node docs/launch-kit/src/render.ts                 # capture the demo, then render all
 *   node docs/launch-kit/src/render.ts --skip-capture  # render from the shots already captured
 *   node docs/launch-kit/src/render.ts --brand-only    # only the brand assets
 *   node docs/launch-kit/src/render.ts --url http://localhost:5500/demo
 *
 * `pnpm --filter @bemmoly/ui brand:banners` runs it with --skip-capture --brand-only.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright.ts';
import { ALL, BRAND, page as htmlPage } from './templates.ts';

const args = process.argv.slice(2);
if (!args.includes('--skip-capture')) {
  const flag = args.indexOf('--url');
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('./capture.ts', import.meta.url)),
      ...(flag === -1 ? [] : ['--url', args[flag + 1]]),
    ],
    { stdio: 'inherit' },
  );
}

const dirs = {
  kit: fileURLToPath(new URL('../images/', import.meta.url)),
  brand: fileURLToPath(new URL('../../../packages/ui/assets/brand/generated/', import.meta.url)),
};
mkdirSync(dirs.kit, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'bemmoly-social-'));

const browser = await chromium.launch();
try {
  for (const image of args.includes('--brand-only') ? BRAND : ALL) {
    const file = join(scratch, `${image.id}.html`);
    writeFileSync(file, htmlPage(image));
    const dir = image.brand ? dirs.brand : dirs.kit;
    const renders = [
      ...(image.scales?.some((s) => s.as === image.id) ? [] : [{ scale: 1, name: image.id }]),
      ...(image.scales ?? []).map((s) => ({ scale: s.scale, name: s.as ?? `${image.id}@${s.scale}x` })),
    ];
    for (const { scale, name } of renders) {
      const page = await browser.newPage({
        viewport: { width: image.width, height: image.height },
        deviceScaleFactor: scale,
      });
      await page.goto(`file://${file}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(dir, `${name}.png`) });
      const size = `${Math.round(image.width * scale)}x${Math.round(image.height * scale)}`;
      process.stdout.write(`${image.brand ? 'brand/' : ''}${name}.png ${size}\n`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

await import('./review.ts');
