import {
  MAINTENANCE_FILE,
  UPDATER_LOCK_FILE,
  UPDATER_LOCK_STALE_MS,
  updaterStatusSchema,
  type MaintenanceState,
  type UpdaterHistoryEntry,
  type UpdaterStatus,
} from '@bemmoly/shared';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** <data>/updater/state.json: read by the app for Settings › Updates and rollback planning. */
export function statePaths(bemmolyDir: string) {
  const data = path.join(bemmolyDir, 'data');
  return {
    data,
    state: path.join(data, 'updater', 'state.json'),
    lock: path.join(data, UPDATER_LOCK_FILE),
    maintenance: path.join(data, MAINTENANCE_FILE),
    env: path.join(bemmolyDir, '.env'),
  };
}

export const IDLE: UpdaterStatus = {
  state: 'idle',
  operation: null,
  step: null,
  message: null,
  current: null,
  previous: null,
  updatedAt: null,
  preUpgradeBackupId: null,
  history: [],
};

async function writeAtomic(file: string, body: string, mode = 0o644): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, body, { mode });
  await rename(`${file}.tmp`, file);
}

export async function readState(bemmolyDir: string): Promise<UpdaterStatus> {
  try {
    return updaterStatusSchema.parse(
      JSON.parse(await readFile(statePaths(bemmolyDir).state, 'utf8')),
    );
  } catch {
    return IDLE;
  }
}

export async function writeState(bemmolyDir: string, state: UpdaterStatus): Promise<void> {
  await writeAtomic(statePaths(bemmolyDir).state, `${JSON.stringify(state, null, 2)}\n`);
}

export function withHistory(state: UpdaterStatus, entry: UpdaterHistoryEntry): UpdaterStatus {
  return { ...state, history: [entry, ...state.history].slice(0, 20) };
}

export async function setMaintenance(
  bemmolyDir: string,
  value: MaintenanceState | null,
): Promise<void> {
  const file = statePaths(bemmolyDir).maintenance;
  if (value) await writeAtomic(file, JSON.stringify(value));
  else await rm(file, { force: true });
}

/** Keeps VERSION in .env in step with the running image, so `compose up` agrees. */
export async function writeVersion(bemmolyDir: string, version: string): Promise<void> {
  const file = statePaths(bemmolyDir).env;
  const lines = (await readFile(file, 'utf8')).split('\n');
  const index = lines.findIndex((line) => line.startsWith('VERSION='));
  if (index >= 0) lines[index] = `VERSION=${version}`;
  else lines.splice(lines.length - 1, 0, `VERSION=${version}`);
  await writeAtomic(file, lines.join('\n'), 0o600);
}

/**
 * One operation at a time across the service and the one-shot CLI. The host CLI, the
 * backup timer and the app's restore read the same file and wait while it is held.
 */
export async function acquireLock(bemmolyDir: string): Promise<() => Promise<void>> {
  const file = statePaths(bemmolyDir).lock;
  await mkdir(path.dirname(file), { recursive: true });
  try {
    const handle = await open(file, 'wx');
    await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const age = Date.now() - (await stat(file)).mtimeMs;
    if (age < UPDATER_LOCK_STALE_MS) {
      throw new Error('Another update or rollback is running; see `bemmoly status`', {
        cause: error,
      });
    }
    await rm(file, { force: true });
    return acquireLock(bemmolyDir);
  }
  return () => rm(file, { force: true });
}
