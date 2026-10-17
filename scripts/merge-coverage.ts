/**
 * Folds every workspace's Cobertura report into one at coverage/cobertura-coverage.xml, so CI
 * uploads a single TypeScript coverage report for the repository. Each `vitest run --coverage`
 * writes `<workspace>/coverage/cobertura-coverage.xml` with filenames relative to that
 * workspace; they are rewritten relative to the repository root, and the totals are summed,
 * so no line data is recomputed.
 *
 *   pnpm turbo run test -- --coverage --coverage.reporter=cobertura
 *   node scripts/merge-coverage.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUTPUT = 'coverage/cobertura-coverage.xml';
const TOTALS = ['lines-valid', 'lines-covered', 'branches-valid', 'branches-covered'] as const;

const reports: string[] = [];
for await (const path of glob('**/coverage/cobertura-coverage.xml', {
  exclude: (path) => path.includes('node_modules'),
})) {
  if (path !== OUTPUT) reports.push(path);
}
reports.sort();
if (reports.length === 0) {
  console.error('No coverage reports found; run the tests with --coverage first.');
  process.exit(1);
}

const sums = Object.fromEntries(TOTALS.map((key) => [key, 0])) as Record<
  (typeof TOTALS)[number],
  number
>;
const packages: string[] = [];

for (const report of reports) {
  const workspace = dirname(dirname(report));
  const xml = readFileSync(report, 'utf8');
  const root = /<coverage\b[^>]*>/.exec(xml)?.[0] ?? '';
  for (const key of TOTALS) {
    sums[key] += Number(new RegExp(`\\b${key}="(\\d+)"`).exec(root)?.[1] ?? 0);
  }
  const body = /<packages>([\s\S]*?)<\/packages>/.exec(xml)?.[1] ?? '';
  packages.push(
    body
      .replace(/(<class\b[^>]*\bfilename=")([^"]*)"/g, `$1${workspace}/$2"`)
      .replace(/(<package\b[^>]*\bname=")([^"]*)"/g, `$1${workspace.replaceAll('/', '.')}.$2"`),
  );
}

const rate = (covered: number, valid: number) => (valid ? covered / valid : 0).toFixed(4);
const attributes = [
  `line-rate="${rate(sums['lines-covered'], sums['lines-valid'])}"`,
  `branch-rate="${rate(sums['branches-covered'], sums['branches-valid'])}"`,
  ...TOTALS.map((key) => `${key}="${sums[key]}"`),
  'complexity="0"',
  'version="0.1"',
  `timestamp="${Date.now()}"`,
].join(' ');

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">',
    `<coverage ${attributes}>`,
    `<sources><source>${process.cwd()}</source></sources>`,
    `<packages>${packages.join('')}</packages>`,
    '</coverage>',
    '',
  ].join('\n'),
);
console.log(`Merged ${reports.length} coverage reports into ${OUTPUT}`);
