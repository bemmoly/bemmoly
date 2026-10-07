import { createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createSqlClient } from '../../../clients/postgres.ts';
import type { SystemDependencies } from '../deps.ts';
import { attachmentsDir } from './attachments.ts';
import { countKeyTables } from './dump.ts';
import { fetchPart, readSetManifest, type SetSource } from './fetch-set.ts';
import type { BackupManifest } from './manifest.ts';
import { createDatabase, dropDatabase, urlForDatabase, withAdmin } from './restore-database.ts';

export class RestoreVerificationError extends Error {
  override readonly name = 'RestoreVerificationError';
}

/** Compares row counts after a restore with the counts taken in the dump's snapshot. */
export function compareRowCounts(
  expected: Record<string, number>,
  actual: Record<string, number>,
): string[] {
  return Object.entries(expected).flatMap(([table, count]) =>
    actual[table] === count
      ? []
      : [`${table}: expected ${count} rows, found ${actual[table] ?? 'no table'}`],
  );
}

/**
 * Restores the dump of `source` into a new database called `name`, then checks the key
 * tables' row counts. The database is dropped again if anything fails.
 */
export async function restoreIntoNewDatabase(
  deps: SystemDependencies,
  source: SetSource,
  manifest: BackupManifest,
  name: string,
  staging: string,
): Promise<Record<string, number>> {
  await mkdir(staging, { recursive: true, mode: 0o750 });
  const dumpFile = path.join(staging, 'database.dump');
  await fetchPart({
    source,
    part: manifest.database,
    passphrase: deps.config.backupPassphrase,
    target: dumpFile,
  });
  await deps.pgTools.list(dumpFile);
  await withAdmin(deps.config.databaseUrl, (admin) => createDatabase(admin, name));
  const url = urlForDatabase(deps.config.databaseUrl, name);
  try {
    await deps.pgTools.restore(url, dumpFile);
    const restored = createSqlClient(url, {
      maxConnections: 1,
      applicationName: 'bemmoly-restore',
    });
    try {
      const counts = await restored.begin((tx) => countKeyTables(tx));
      const problems = compareRowCounts(manifest.database.rowCounts, counts);
      if (problems.length > 0) {
        throw new RestoreVerificationError(
          `Restored rows do not match the backup: ${problems.join('; ')}`,
        );
      }
      return counts;
    } finally {
      await restored.end({ timeout: 5 });
    }
  } catch (error) {
    await withAdmin(deps.config.databaseUrl, (admin) => dropDatabase(admin, name));
    throw error;
  } finally {
    await rm(dumpFile, { force: true });
  }
}

/** Extracts every attachment archive in the manifest's chain, oldest first. */
export async function restoreAttachments(
  deps: SystemDependencies,
  source: SetSource,
  manifest: BackupManifest,
  staging: string,
): Promise<number> {
  const root = attachmentsDir(deps.config.dataDir);
  await mkdir(root, { recursive: true });
  let extracted = 0;
  for (const setName of manifest.attachments.chain) {
    const link: SetSource = { destination: source.destination, setName };
    const linkManifest = setName === manifest.setName ? manifest : await readSetManifest(link);
    const archive = linkManifest.attachments.archive;
    if (!archive) continue;
    const file = path.join(staging, `${setName}.tar`);
    await fetchPart({
      source: link,
      part: archive,
      passphrase: deps.config.backupPassphrase,
      target: file,
    });
    await deps.tar.extract(createReadStream(file), root);
    await rm(file, { force: true });
    extracted += linkManifest.attachments.fileCount;
  }
  return extracted;
}
