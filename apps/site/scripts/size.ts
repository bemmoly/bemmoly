/**
 * Size budget: the JavaScript each page loads, gzipped, inline and external, must stay under
 * 30 KB. Astro ships none by default; the scripts today are the inline copy button and the
 * self-hosting chooser. JSON-LD blocks are data the browser never runs, so they do not count.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 30 * 1024;
const dist = new URL('../dist/', import.meta.url);

let failed = false;
// dist/demo is the live demo, the app itself, not a page of the site; it loads only when asked.
const pages = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.html') && !file.startsWith('demo/'),
);
for (const page of pages) {
  const html = readFileSync(new URL(page, dist), 'utf8');
  const code = /<script\b(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
  const inline = [...html.matchAll(code)].map((match) => match[1] ?? '');
  const external = [...html.matchAll(/<script\b[^>]*\bsrc="\/([^"]+)"/g)].map((match) =>
    readFileSync(new URL(match[1] ?? '', dist), 'utf8'),
  );
  const bytes = gzipSync([...inline, ...external].join('\n')).length;
  const size = [...inline, ...external].length === 0 ? 0 : bytes;
  const ok = size <= BUDGET;
  failed ||= !ok;
  process.stdout.write(
    `${ok ? 'ok  ' : 'FAIL'} ${page.padEnd(36)} ${(size / 1024).toFixed(2)} KB gzip JS\n`,
  );
}
if (failed) process.exit(1);
