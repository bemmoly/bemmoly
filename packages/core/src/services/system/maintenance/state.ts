import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MAINTENANCE_FILE,
  maintenanceStateSchema,
  type MaintenanceState,
} from '@bemmoly/shared';

export { MAINTENANCE_FILE, maintenanceStateSchema, type MaintenanceState };

/**
 * Maintenance mode is a file in the data folder, not a database row: during a restore
 * the database is being replaced, and the updater (another container) shares the same
 * folder and serves the same message while the app is down.
 */
const fileIn = (dataDir: string) => path.join(dataDir, MAINTENANCE_FILE);

export async function readMaintenance(dataDir: string): Promise<MaintenanceState | null> {
  try {
    return maintenanceStateSchema.parse(JSON.parse(await readFile(fileIn(dataDir), 'utf8')));
  } catch {
    return null;
  }
}

export async function enterMaintenance(
  dataDir: string,
  state: Omit<MaintenanceState, 'startedAt'> & { startedAt?: Date },
): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const target = fileIn(dataDir);
  const value: MaintenanceState = {
    reason: state.reason,
    message: state.message,
    step: state.step,
    startedAt: (state.startedAt ?? new Date()).toISOString(),
  };
  await writeFile(`${target}.tmp`, JSON.stringify(value), { mode: 0o644 });
  await rename(`${target}.tmp`, target);
}

export async function exitMaintenance(dataDir: string): Promise<void> {
  await rm(fileIn(dataDir), { force: true });
}

/** Cached reader for the request hook: at most one file read per second per process. */
export function createMaintenanceReader(dataDir: string, ttlMs = 1_000) {
  let cached: { at: number; state: MaintenanceState | null } | undefined;
  return async (): Promise<MaintenanceState | null> => {
    const now = Date.now();
    if (cached && now - cached.at < ttlMs) return cached.state;
    cached = { at: now, state: await readMaintenance(dataDir) };
    return cached.state;
  };
}
