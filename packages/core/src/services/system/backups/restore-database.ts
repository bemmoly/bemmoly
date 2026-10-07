import { createSqlClient, type SqlClient } from '../../../clients/postgres.ts';
import type { SystemDependencies } from '../deps.ts';

const DAY_MS = 86_400_000;
const STAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

export function databaseNameOf(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, '')) || 'postgres';
}

export function urlForDatabase(databaseUrl: string, name: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${encodeURIComponent(name)}`;
  return url.toString();
}

export function stampOf(date: Date): string {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function parseStamp(stamp: string): Date | null {
  const match = STAMP.exec(stamp);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, d, h, mi, s));
}

/** A connection to the maintenance database, for CREATE, DROP and RENAME DATABASE. */
export async function withAdmin<T>(
  databaseUrl: string,
  run: (admin: SqlClient) => Promise<T>,
): Promise<T> {
  const admin = createSqlClient(urlForDatabase(databaseUrl, 'postgres'), {
    applicationName: 'bemmoly-restore',
    maxConnections: 1,
    statementTimeoutMs: 120_000,
  });
  try {
    return await run(admin);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

export async function createDatabase(admin: SqlClient, name: string): Promise<void> {
  await admin`create database ${admin(name)} template template0`;
}

export async function dropDatabase(admin: SqlClient, name: string): Promise<void> {
  await admin`drop database if exists ${admin(name)} with (force)`;
}

/**
 * Puts `replacement` in place of `live` by renaming, so DATABASE_URL never changes.
 * Sessions on the live database are ended first; the app's pool reconnects to the new
 * one. The old database stays as `rolledBack` for the retention window.
 */
export async function swapDatabases(
  admin: SqlClient,
  names: { live: string; replacement: string; rolledBack: string },
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    await admin`
      select pg_terminate_backend(pid) from pg_stat_activity
      where datname = ${names.live} and pid <> pg_backend_pid()`;
    try {
      await admin`alter database ${admin(names.live)} rename to ${admin(names.rolledBack)}`;
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  await admin`alter database ${admin(names.replacement)} rename to ${admin(names.live)}`;
}

export async function makeReadOnly(admin: SqlClient, name: string): Promise<void> {
  await admin`alter database ${admin(name)} set default_transaction_read_only = on`;
}

/** Databases this service created: replaced, mounted or drill copies of `live`. */
export async function listSideDatabases(
  admin: SqlClient,
  live: string,
): Promise<
  { name: string; purpose: 'rolledback' | 'mount' | 'restore' | 'drill'; createdAt: Date | null }[]
> {
  const rows = await admin<{ datname: string }[]>`
    select datname from pg_database where datname like ${`${live}\\_%`}`;
  const pattern = new RegExp(`^${live}_(rolledback|mount|restore|drill)_(\\d{14})$`);
  return rows.flatMap((row) => {
    const match = pattern.exec(row.datname);
    if (!match) return [];
    return [
      {
        name: row.datname,
        purpose: match[1] as 'rolledback' | 'mount' | 'restore' | 'drill',
        createdAt: parseStamp(match[2] ?? ''),
      },
    ];
  });
}

/**
 * Drops replaced databases older than the window, and drill or half-finished restore
 * copies older than a day (left behind by a crash). Mounted copies stay until unmounted.
 */
export async function dropExpiredDatabases(
  deps: SystemDependencies,
  windowDays: number,
  now: Date,
): Promise<string[]> {
  const live = databaseNameOf(deps.config.databaseUrl);
  return withAdmin(deps.config.databaseUrl, async (admin) => {
    const dropped: string[] = [];
    for (const side of await listSideDatabases(admin, live)) {
      if (!side.createdAt || side.purpose === 'mount') continue;
      const ageDays = (now.getTime() - side.createdAt.getTime()) / DAY_MS;
      const limit = side.purpose === 'rolledback' ? windowDays : 1;
      if (ageDays <= limit) continue;
      await dropDatabase(admin, side.name);
      dropped.push(side.name);
      deps.logger.info({ database: side.name }, 'dropped an expired side database');
    }
    return dropped;
  });
}
