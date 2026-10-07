import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAINTENANCE_FILE, maintenanceStateSchema, type MaintenanceState } from '@bemmoly/shared';

export { MAINTENANCE_FILE, maintenanceStateSchema, type MaintenanceState };

/**
 * Maintenance mode is a file in the data folder, not a database row: during a restore
 * the database is being replaced, and the updater (another container) shares the same
 * folder and serves the same message while the app is down.
 */
const fileIn = (dataDir: string) => path.join(dataDir, MAINTENANCE_FILE);

/** Bumped by every enter and exit in this process, so cached readers see it at once. */
let localChanges = 0;

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
  localChanges += 1;
}

export async function exitMaintenance(dataDir: string): Promise<void> {
  await rm(fileIn(dataDir), { force: true });
  localChanges += 1;
}

/**
 * Reader for the request hook. Outside maintenance it reads the file at most once per
 * `ttlMs`, which is the common case. During maintenance it reads on every request: the
 * updater or bemmoly-system ends it from another process, and a cached "still on" would
 * refuse writes for up to `ttlMs` after /readyz already said ready.
 */
export function createMaintenanceReader(dataDir: string, ttlMs = 1_000) {
  let cached: { at: number; changes: number; state: MaintenanceState | null } | undefined;
  return async (): Promise<MaintenanceState | null> => {
    const now = Date.now();
    const fresh =
      cached && cached.state === null && cached.changes === localChanges && now - cached.at < ttlMs;
    if (fresh) return null;
    cached = { at: now, changes: localChanges, state: await readMaintenance(dataDir) };
    return cached.state;
  };
}
