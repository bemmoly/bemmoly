import type { SystemCheck } from '@bemmoly/shared';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import type { SqlClient } from '../../../clients/postgres.ts';
import {
  MIN_POSTGRES_MAJOR,
  postgresRequirementProblem,
  readPostgresServer,
} from './postgres-requirement.ts';
import { diskSpace, formatBytes } from '../utils/disk.ts';

const GB = 1024 ** 3;

export async function checkPostgres(sql: SqlClient, databaseUrl: string): Promise<SystemCheck> {
  const url = new URL(databaseUrl);
  const where = `${url.hostname}:${url.port || '5432'}`;
  const started = performance.now();
  try {
    const info = await readPostgresServer(sql);
    const latency = Math.round(performance.now() - started);
    const value = `${where} · ${latency} ms`;
    const problem = postgresRequirementProblem(info);
    if (problem) {
      return {
        id: 'postgres',
        name: `Postgres ${info.major}`,
        status: 'fail',
        value: info.major < MIN_POSTGRES_MAJOR ? value : `${value} · ${problem.message}`,
        fix: {
          label: info.major < MIN_POSTGRES_MAJOR ? 'Upgrade Postgres' : 'Install extensions',
          hint: `${problem.message}. ${problem.fix}`,
        },
      };
    }
    return { id: 'postgres', name: `Postgres ${info.major}`, status: 'ok', value, fix: null };
  } catch {
    return {
      id: 'postgres',
      name: 'Postgres',
      status: 'fail',
      value: `${where} · not reachable`,
      fix: {
        label: 'Check DATABASE_URL',
        hint: 'Run `sudo bemmoly doctor` on the server to see why the database does not answer.',
      },
    };
  }
}

export async function checkDisk(dataDir: string): Promise<SystemCheck> {
  const { freeBytes, totalBytes } = await diskSpace(dataDir);
  const value = `${formatBytes(freeBytes)} free of ${formatBytes(totalBytes)}`;
  if (freeBytes < 2 * GB) {
    return {
      id: 'disk',
      name: 'Disk',
      status: 'fail',
      value,
      fix: { label: 'Free space', hint: 'Less than 2 GB is free; backups and uploads will fail.' },
    };
  }
  if (freeBytes < 10 * GB) {
    return {
      id: 'disk',
      name: 'Disk',
      status: 'warn',
      value,
      fix: {
        label: 'Free space',
        hint: 'Less than 10 GB is free; keep at least twice your last backup free.',
      },
    };
  }
  return { id: 'disk', name: 'Disk', status: 'ok', value, fix: null };
}

/** The container's memory limit when cgroups set one, else the host's memory. */
async function memoryBytes(): Promise<number> {
  try {
    const limit = (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim();
    if (/^\d+$/.test(limit)) return Math.min(Number(limit), os.totalmem());
  } catch {
    // Not a cgroup v2 container; the host total is the limit.
  }
  return os.totalmem();
}

export async function checkMemory(): Promise<SystemCheck> {
  const bytes = await memoryBytes();
  const value = `${Math.round(bytes / GB)} GB · ${os.availableParallelism()} vCPU`;
  if (bytes < 1.8 * GB) {
    return {
      id: 'memory',
      name: 'Memory',
      status: 'fail',
      value,
      fix: { label: 'Resize', hint: 'Bemmoly needs 2 GB; 4 GB is comfortable for 200 people.' },
    };
  }
  if (bytes < 3.5 * GB) {
    return {
      id: 'memory',
      name: 'Memory',
      status: 'warn',
      value,
      fix: { label: 'Details', hint: 'Fine for up to 50 people; 4 GB is recommended for 200.' },
    };
  }
  return { id: 'memory', name: 'Memory', status: 'ok', value, fix: null };
}

export function checkSmtp(described: { configured: boolean; value: string } | null): SystemCheck {
  if (described?.configured) {
    return {
      id: 'smtp',
      name: 'Outbound email (SMTP)',
      status: 'ok',
      value: described.value,
      fix: null,
    };
  }
  return {
    id: 'smtp',
    name: 'Outbound email (SMTP)',
    status: 'warn',
    value: 'not configured',
    fix: {
      label: 'Configure',
      hint: 'Invites and notifications need an SMTP relay.',
      href: '/settings/email',
    },
  };
}

/** What the proxy told the app: the scheme people use and how the certificate is issued. */
export interface HttpsSignal {
  publicUrl: string;
  /** Request scheme after trust-proxy, i.e. what the browser used. */
  protocol: string;
  /** X-Bemmoly-Tls from the bundled proxy: "auto" or "internal" (self-signed). */
  tlsMode: string | undefined;
}

export function checkHttps(signal: HttpsSignal): SystemCheck {
  const httpsUrl = signal.publicUrl.startsWith('https://');
  if (signal.protocol !== 'https' || !httpsUrl) {
    return {
      id: 'https',
      name: 'HTTPS',
      status: 'warn',
      value: 'served over HTTP',
      fix: {
        label: 'Enable HTTPS',
        hint: 'Re-run the installer with --domain, or terminate TLS in your own proxy and set BEMMOLY_PUBLIC_URL to https://.',
      },
    };
  }
  if (signal.tlsMode === 'internal') {
    return {
      id: 'https',
      name: 'HTTPS',
      status: 'warn',
      value: 'self-signed until DNS resolves',
      fix: {
        label: 'Point DNS',
        hint: 'Point the domain at this server; the proxy requests a real certificate as soon as it resolves.',
      },
    };
  }
  const value =
    signal.tlsMode === 'auto' ? 'automatic certificate · auto-renew' : 'terminated by your proxy';
  return { id: 'https', name: 'HTTPS', status: 'ok', value, fix: null };
}
