#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines demo:monorepo
 *
 * Puts Acme Market, a monorepo with one repository file, into a seeded install the way a
 * push to its default branch would: scripts/demo/monorepo holds its files. Three services
 * share a Dockerfile with a SERVICE build arg, a web app has its own Dockerfile and
 * application.yaml, and a library is only checked. Then discovery scans the same tree as a
 * second repository with no Bemmoly files, so Set up proposes a repository file for it.
 * Safe to repeat.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSqlClient } from '@bemmoly/core';
import { isApplicationFile, isRepositoryFile } from '../server/src/services/catalog-writes/file.ts';
import { syncApplicationFiles } from '../server/src/services/catalog-writes/sync.ts';
import { fixtureTree } from '../server/src/services/discovery/fixture-tree.ts';
import { scanRepository } from '../server/src/services/discovery/scan.ts';
import { loadSeedConfig } from './demo/config.ts';

const ROOT = fileURLToPath(new URL('./demo/monorepo/', import.meta.url));
const COMMIT = 'a7c3e91f00d4';
const out = (line: string) => process.stdout.write(`${line}\n`);

const sql = createSqlClient(loadSeedConfig().databaseUrl, {
  applicationName: 'bemmoly-monorepo-demo',
  maxConnections: 2,
});

try {
  const tree = await fixtureTree(ROOT, COMMIT);
  const catalogFiles = tree.paths.filter(
    (path) => isApplicationFile(path) || isRepositoryFile(path),
  );
  const files = await Promise.all(
    catalogFiles.map(async (path) => ({ path, content: await readFile(`${ROOT}${path}`, 'utf8') })),
  );
  const synced = await sql.begin((tx) =>
    syncApplicationFiles(tx, {
      repository: {
        fullName: 'acme/market',
        provider: 'github',
        defaultBranch: 'main',
        url: 'https://github.com/acme/market',
      },
      commitSha: COMMIT,
      files,
      complete: true,
    }),
  );
  out(`acme/market: applied ${synced.applied.sort().join(', ') || 'nothing'}`);
  for (const problem of synced.problems) out(`  ${problem.path}: ${problem.message}`);

  const bare = { ...tree, paths: tree.paths.filter((path) => !path.includes('.bemmoly/')) };
  const scanned = await scanRepository(
    sql,
    { fullName: 'acme/market-next', provider: 'github', defaultBranch: 'main' },
    bare,
  );
  out(`acme/market-next: ${scanned.proposed} proposals, one repository file`);
} finally {
  await sql.end();
}
