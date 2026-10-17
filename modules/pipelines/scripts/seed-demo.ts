#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines seed:demo [-- --reset] [-- --scale 0.2]
 *
 * Seeds the Acme demo organisation into the database in apps/server/.env. The package script
 * enables the Pipelines module first (granted to everyone), which applies its changesets.
 * Refuses to run over an existing catalog unless --reset is given.
 */
import { parseArgs } from 'node:util';
import { createSqlClient } from '@bemmoly/core';
import { loadPipelinesObjects, loadSeedConfig } from './demo/config.ts';
import { hasCatalog, resetDemo } from './demo/reset.ts';
import { seedDemo } from './demo/seed.ts';

const { values } = parseArgs({
  // `pnpm … seed:demo -- --reset` passes the separator through; options follow it either way.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { reset: { type: 'boolean', default: false }, scale: { type: 'string', default: '1' } },
});
const scale = Number(values.scale);
if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
  process.stderr.write('--scale takes a number above 0 and at most 1\n');
  process.exit(2);
}

const { databaseUrl } = loadSeedConfig();
const sql = createSqlClient(databaseUrl, {
  applicationName: 'bemmoly-pipelines-seed',
  maxConnections: 4,
  statementTimeoutMs: 0,
  idleInTransactionTimeoutMs: 0,
});
const started = Date.now();
const log = (line: string) =>
  process.stdout.write(`[seed] ${((Date.now() - started) / 1000).toFixed(1)}s  ${line}\n`);

try {
  const [table] = await sql<
    { name: string | null }[]
  >`select to_regclass('pipeline_domains')::text as name`;
  if (!table?.name) {
    process.stderr.write(
      'Pipelines is not enabled yet. Run: pnpm --filter @bemmoly/server db modules enable pipelines --access everyone\n',
    );
    process.exitCode = 1;
  } else if ((await hasCatalog(sql)) && !values.reset) {
    process.stderr.write(
      'Pipelines already has a catalog. Run again with --reset to replace it.\n',
    );
    process.exitCode = 1;
  } else {
    if (values.reset) {
      await resetDemo(sql);
      log('cleared the previous demo');
    }
    const objects = await loadPipelinesObjects(sql);
    const { demo } = await seedDemo(sql, { scale, log, objects });
    log(`done. For you belongs to ${demo.name}.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
