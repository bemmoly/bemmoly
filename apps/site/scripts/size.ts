/**
 * Size budget: the JavaScript each page loads, gzipped, inline and external, must stay under
 * 30 KB. Astro ships none by default; the only script today is the inline copy button.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 30 * 1024;
const dist = new URL('../dist/', import.meta.url);

let failed = false;
for (const page of readdirSync(dist).filter((file) => file.endsWith('.html'))) {
  const html = readFileSync(new URL(page, dist), 'utf8');
  const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1] ?? '',
  );
  const external = [...html.matchAll(/<script\b[^>]*\bsrc="\/([^"]+)"/g)].map((match) =>
    readFileSync(new URL(match[1] ?? '', dist), 'utf8'),
  );
  const bytes = gzipSync([...inline, ...external].join('\n')).length;
  const size = [...inline, ...external].length === 0 ? 0 : bytes;
  const ok = size <= BUDGET;
  failed ||= !ok;
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${page.padEnd(20)} ${(size / 1024).toFixed(2)} KB gzip JS\n`);
}
if (failed) process.exit(1);
