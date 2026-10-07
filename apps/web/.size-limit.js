import { existsSync, readFileSync } from 'node:fs';

/**
 * The shell's initial JS is every script index.html loads: the entry and the
 * app chunks the boot frame preloads (boot-frame.ts), so the budget follows
 * the build instead of a file-name pattern.
 */
const html = new URL('./dist/index.html', import.meta.url);
if (!existsSync(html)) throw new Error('size-limit: build the web shell first (pnpm build)');
const scripts = [
  ...readFileSync(html, 'utf8').matchAll(/(?:src|href)="\/(assets\/[\w.-]+\.js)"/g),
].map((match) => `dist/${match[1]}`);

export default [
  {
    name: 'web shell, initial JS (gzip)',
    path: scripts,
    limit: '250 KB',
    gzip: true,
  },
];
