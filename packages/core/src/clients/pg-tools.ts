import path from 'node:path';
import type { RunOptions } from './process.ts';
import { runProcess } from './process.ts';

const HOUR_MS = 60 * 60 * 1_000;

export interface PgToolsOptions {
  /** Folder holding pg_dump, pg_restore and psql (Postgres 18 client tools). */
  binDir: string;
  /** Upper bound for a dump or a restore. */
  longTimeoutMs?: number;
  shortTimeoutMs?: number;
}

export interface DumpOptions {
  /** A snapshot exported by pg_export_snapshot(), so row counts match the dump exactly. */
  snapshot?: string;
  signal?: AbortSignal;
}

export interface RestoreOptions {
  jobs?: number;
  signal?: AbortSignal;
}

/** The Postgres client tools, run without a shell and without a password in argv. */
export interface PgTools {
  version(): Promise<string>;
  dump(
    databaseUrl: string,
    into: NonNullable<RunOptions['stdout']>,
    options?: DumpOptions,
  ): Promise<void>;
  /** pg_restore --list; throws when the archive is unreadable. */
  list(file: string): Promise<string>;
  restore(databaseUrl: string, file: string, options?: RestoreOptions): Promise<void>;
}

interface Connection {
  dbname: string;
  env: NodeJS.ProcessEnv;
}

/** Moves the password out of the URL and into PGPASSWORD for the child only. */
export function connectionFor(databaseUrl: string): Connection {
  const url = new URL(databaseUrl);
  const password = decodeURIComponent(url.password);
  url.password = '';
  return {
    dbname: url.toString(),
    env: password ? { PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' } : { PGCONNECT_TIMEOUT: '10' },
  };
}

/** pg_export_snapshot() ids are hex groups joined by dashes, such as 00000003-0000001B-1. */
const SNAPSHOT_ID = /^[0-9A-F]+(?:-[0-9A-F]+)*$/i;

export function createPgTools(options: PgToolsOptions): PgTools {
  const bin = (name: string) => path.join(options.binDir, name);
  const long = options.longTimeoutMs ?? 6 * HOUR_MS;
  const short = options.shortTimeoutMs ?? 5 * 60 * 1_000;
  return {
    async version() {
      const { stdout } = await runProcess(bin('pg_dump'), ['--version'], { timeoutMs: short });
      return stdout.trim();
    },
    async dump(databaseUrl, into, dumpOptions = {}) {
      const connection = connectionFor(databaseUrl);
      const args = [
        '--format=custom',
        '--compress=6',
        '--no-password',
        '--dbname',
        connection.dbname,
      ];
      if (dumpOptions.snapshot) {
        if (!SNAPSHOT_ID.test(dumpOptions.snapshot)) throw new Error('Invalid snapshot id');
        args.push('--snapshot', dumpOptions.snapshot);
      }
      await runProcess(bin('pg_dump'), args, {
        env: connection.env,
        timeoutMs: long,
        stdout: into,
        ...(dumpOptions.signal ? { signal: dumpOptions.signal } : {}),
      });
    },
    async list(file) {
      const { stdout } = await runProcess(bin('pg_restore'), ['--list', file], {
        timeoutMs: short,
      });
      return stdout;
    },
    async restore(databaseUrl, file, restoreOptions = {}) {
      const jobs = restoreOptions.jobs ?? 2;
      if (!Number.isInteger(jobs) || jobs < 1) throw new Error('jobs must be a positive integer');
      const connection = connectionFor(databaseUrl);
      const args = [
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--no-password',
        '--jobs',
        String(jobs),
        '--dbname',
        connection.dbname,
        file,
      ];
      await runProcess(bin('pg_restore'), args, {
        env: connection.env,
        timeoutMs: long,
        ...(restoreOptions.signal ? { signal: restoreOptions.signal } : {}),
      });
    },
  };
}
