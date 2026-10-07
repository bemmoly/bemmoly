import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { createPgTools, type PgTools } from '../../../../clients/pg-tools.ts';
import { createSqlClient, type SqlClient } from '../../../../clients/postgres.ts';
import { runProcess } from '../../../../clients/process.ts';
import { createTarTool } from '../../../../clients/tar.ts';
import type { SystemDependencies } from '../../deps.ts';
import { createLocalDestination } from '../destinations/local.ts';
import type { BackupDestination } from '../destinations/types.ts';
import { urlForDatabase, withAdmin } from '../restore-database.ts';

const PG_BIN_CANDIDATES = [
  '/usr/lib/postgresql/18/bin',
  '/opt/homebrew/opt/libpq/bin',
  '/usr/local/opt/libpq/bin',
];

/** Postgres 18 client tools on this machine, or the reason they cannot be used. */
export async function findPgTools(
  preferred: string | undefined,
): Promise<{ tools: PgTools } | { reason: string }> {
  const dirs = preferred ? [preferred] : PG_BIN_CANDIDATES;
  for (const dir of dirs) {
    if (!existsSync(path.join(dir, 'pg_dump'))) continue;
    const { stdout } = await runProcess(path.join(dir, 'pg_dump'), ['--version'], {
      timeoutMs: 10_000,
    });
    const major = Number(/(\d+)\.\d+/.exec(stdout)?.[1] ?? 0);
    if (major >= 18) return { tools: createPgTools({ binDir: dir }) };
  }
  return { reason: 'Skipped: Postgres 18 client tools not found (set BEMMOLY_TEST_PG_BIN_DIR)' };
}

export interface Harness {
  deps: SystemDependencies;
  sql: SqlClient;
  databaseUrl: string;
  dataDir: string;
  backupDir: string;
  local: BackupDestination;
}

/** A private database on the test server, so renames during restore touch nothing else. */
export async function createHarness(input: {
  serverUrl: string;
  pgTools: PgTools;
  destinations: () => BackupDestination[];
  passphrase?: string;
}): Promise<Harness> {
  const name = `bemmoly_it_${Math.random().toString(36).slice(2, 10)}`;
  await withAdmin(input.serverUrl, async (admin) => {
    await admin`create database ${admin(name)}`;
  });
  const databaseUrl = urlForDatabase(input.serverUrl, name);
  const root = await mkdtemp(path.join(os.tmpdir(), 'bemmoly-backups-'));
  const dataDir = path.join(root, 'data');
  const backupDir = path.join(root, 'backups');
  await mkdir(path.join(dataDir, 'attachments'), { recursive: true });
  const sql = createSqlClient(databaseUrl, { maxConnections: 4, statementTimeoutMs: 0 });
  const local = createLocalDestination(backupDir);
  const deps: SystemDependencies = {
    config: {
      databaseUrl,
      dataDir,
      backupDir,
      appVersion: '0.1.0-test',
      role: 'all',
      publicUrl: 'https://bemmoly.test',
      ...(input.passphrase ? { backupPassphrase: input.passphrase } : {}),
    },
    sql,
    pgTools: input.pgTools,
    tar: createTarTool(),
    logger: pino({ level: 'silent' }),
    authorize: async () => undefined,
    modules: () => ['sample'],
    destinations: async () => [local, ...input.destinations()],
  };
  return { deps, sql, databaseUrl, dataDir, backupDir, local };
}

export async function writeAttachment(dataDir: string, name: string, body: string): Promise<void> {
  const file = path.join(dataDir, 'attachments', name.slice(0, 2), name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}
