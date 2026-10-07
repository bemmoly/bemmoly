import {
  applySystemChangesets,
  checkForUpdates,
  computeRollbackPlan,
  createBackupRepository,
  enterMaintenance,
  exitMaintenance,
  getSystemHealth,
  getUpdatesOverview,
  mountBackup,
  pruneBackups,
  readMaintenance,
  restoreBackup,
  runBackup,
  syncBackupIndex,
  toBackupDto,
  unmountBackup,
  verifyBackup,
} from '@bemmoly/core';
import { backupKindSchema } from '@bemmoly/shared';
import { CLI_ACTOR, UsageError, type Runtime } from './runtime.ts';

export interface CommandInput {
  args: string[];
  flags: Record<string, string | boolean | undefined>;
  log: (line: string) => void;
}

const HOUR_MS = 3_600_000;

function hours(value: string | boolean | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)h$/.exec(value);
  if (!match) throw new UsageError(`--if-older-than takes hours, e.g. 36h (got "${value}")`);
  return Number(match[1]);
}

function required(args: string[], index: number, what: string): string {
  const value = args[index];
  if (!value) throw new UsageError(`Missing ${what}`);
  return value;
}

async function backup(runtime: Runtime, input: CommandInput) {
  const kind = backupKindSchema.parse(input.flags['kind'] ?? 'manual');
  const olderThan = hours(input.flags['if-older-than']);
  if (olderThan !== null) {
    const latest = await createBackupRepository(runtime.sql).latest({ status: 'succeeded' });
    if (latest && Date.now() - latest.createdAt.getTime() < olderThan * HOUR_MS) {
      return {
        skipped: true,
        reason: `the last backup is younger than ${olderThan} h`,
        latest: latest.setName,
      };
    }
  }
  return toBackupDto(await runBackup(runtime.deps, { kind }));
}

async function status(runtime: Runtime) {
  const [size] = await runtime.sql<{ bytes: string }[]>`
    select pg_database_size(current_database())::text as bytes`;
  const [queue] = await runtime.sql<{ depth: string | null }[]>`
    select case when to_regclass('pgboss.job') is null then null
      else (select count(*)::text from pgboss.job where state in ('created', 'retry')) end as depth`;
  const repository = createBackupRepository(runtime.sql);
  const latest = await repository.latest({ status: 'succeeded' }).catch(() => null);
  return {
    version: runtime.env.BEMMOLY_VERSION,
    role: runtime.env.BEMMOLY_ROLE,
    databaseBytes: Number(size?.bytes ?? 0),
    queueDepth: queue?.depth === null || queue?.depth === undefined ? null : Number(queue.depth),
    lastBackup: latest
      ? {
          set: latest.setName,
          at: latest.createdAt.toISOString(),
          sizeBytes: latest.sizeBytes,
          verification: latest.verificationState,
        }
      : null,
    maintenance: await readMaintenance(runtime.env.BEMMOLY_DATA_DIR),
  };
}

type Command = (runtime: Runtime, input: CommandInput) => Promise<unknown>;

export const COMMANDS: Record<string, Command> = {
  backup,
  backups: async (runtime, input) => {
    const records = await createBackupRepository(runtime.sql).list({
      limit: Number(input.flags['limit'] ?? 50),
    });
    return records.map(toBackupDto);
  },
  verify: async (runtime, input) => {
    const ref = required(input.args, 0, 'a backup set name or id');
    const record = await createBackupRepository(runtime.sql).findBySetName(ref);
    const result = await verifyBackup(
      runtime.deps,
      record?.id ?? ref,
      input.flags['drill'] ? 'restore' : 'list',
    );
    if (!result.ok) process.exitCode = 3;
    return result;
  },
  restore: (runtime, input) =>
    restoreBackup(
      runtime.deps,
      required(input.args, 0, 'a backup (set name, id, folder or s3:// URL)'),
    ),
  mount: (runtime, input) =>
    mountBackup(runtime.deps, required(input.args, 0, 'a backup to mount')),
  unmount: async (runtime, input) => {
    const name = required(input.args, 0, 'the mounted database name');
    await unmountBackup(runtime.deps, name);
    return { unmounted: name };
  },
  'rollback-plan': async (runtime, input) =>
    (await computeRollbackPlan(runtime.deps, {
      preferRestore: Boolean(input.flags['prefer-restore']),
    })) ?? {
      mode: null,
      summary: 'There is no update inside the rollback window to roll back.',
    },
  status,
  // The host CLI passes --tls from BEMMOLY_TLS_MODE in .env; the proxy is not in the path here.
  health: (runtime, input) =>
    getSystemHealth(runtime.deps, null, {
      publicUrl: runtime.env.BEMMOLY_PUBLIC_URL,
      protocol: runtime.env.BEMMOLY_PUBLIC_URL.startsWith('https') ? 'https' : 'http',
      tlsMode: typeof input.flags['tls'] === 'string' ? input.flags['tls'] : undefined,
    }),
  updates: (runtime) => getUpdatesOverview(runtime.deps, CLI_ACTOR),
  'update-check': (runtime) => checkForUpdates(runtime.deps, { force: true }),
  prune: (runtime) => pruneBackups(runtime.deps),
  'sync-index': async (runtime) => ({ added: await syncBackupIndex(runtime.deps) }),
  schema: async (runtime, input) => {
    if (input.args[0] !== 'apply') throw new UsageError('Usage: bemmoly-system schema apply');
    return { applied: await applySystemChangesets(runtime.sql, input.log) };
  },
  maintenance: async (runtime, input) => {
    const mode = required(input.args, 0, 'on or off');
    if (mode === 'off') {
      await exitMaintenance(runtime.env.BEMMOLY_DATA_DIR);
      return { maintenance: null };
    }
    const reason = required(input.args, 1, 'a reason: restore, update or rollback');
    if (reason !== 'restore' && reason !== 'update' && reason !== 'rollback')
      throw new UsageError(`Unknown reason ${reason}`);
    await enterMaintenance(runtime.env.BEMMOLY_DATA_DIR, {
      reason,
      message: input.args.slice(2).join(' ') || 'Bemmoly is being updated.',
      step: typeof input.flags['step'] === 'string' ? input.flags['step'] : null,
    });
    return { maintenance: await readMaintenance(runtime.env.BEMMOLY_DATA_DIR) };
  },
};
