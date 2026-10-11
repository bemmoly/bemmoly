/**
 * `pnpm i18n:check`: the catalog gate CI runs (see check.ts).
 * `pnpm i18n:extract [--locale fr]`: sorts every catalog, adds a locale's files beside each
 * source, and lists ids the code uses that have no English yet (see extract.ts).
 * docs/i18n.md walks through both.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { SHIPPED_LOCALES, SOURCE_LOCALE } from '@bemmoly/shared';
import { checkCatalogs } from './check.ts';
import { CatalogError } from './compile.ts';
import { planExtract, serialise } from './extract.ts';
import { findUsages, loadCatalogs, repoFiles } from './repo.ts';

const root = join(import.meta.dirname, '../../..');
const out = (line: string) => process.stdout.write(`${line}\n`);
const fail = (line: string) => process.stderr.write(`${line}\n`);

function readIfThere(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function main(): number {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { locale: { type: 'string' } },
  });
  const files = repoFiles(root);
  const catalogs = loadCatalogs(root, files);
  const usages = findUsages(root, files);
  const command = positionals[0] ?? 'check';
  if (command === 'check') {
    const { errors, warnings } = checkCatalogs(catalogs, usages, {
      source: SOURCE_LOCALE,
      shipped: SHIPPED_LOCALES,
    });
    for (const warning of warnings) out(`warning  ${warning}`);
    for (const error of errors) fail(`error    ${error}`);
    out(
      `${catalogs.length} catalogs, ${usages.size} ids used in code, shipped: ${SHIPPED_LOCALES.join(', ')}`,
    );
    return errors.length > 0 ? 1 : 0;
  }
  if (command === 'extract') {
    const plan = planExtract(catalogs, usages, { source: SOURCE_LOCALE, locale: values.locale });
    let changed = 0;
    for (const write of plan.writes) {
      const path = join(root, write.file);
      const next = serialise(write.messages);
      if (readIfThere(path) === next) continue;
      writeFileSync(path, next);
      changed += 1;
      out(`wrote    ${write.file}`);
    }
    for (const id of plan.unwritten) fail(`no English for ${id} (${usages.get(id)?.join(', ')})`);
    out(`${changed} catalogs changed`);
    return plan.unwritten.length > 0 ? 1 : 0;
  }
  fail(`Unknown command "${command}". Use check or extract [--locale <tag>].`);
  return 2;
}

try {
  process.exitCode = main();
} catch (error) {
  if (!(error instanceof CatalogError)) throw error;
  fail(`error    ${error.message}`);
  process.exitCode = 1;
}
