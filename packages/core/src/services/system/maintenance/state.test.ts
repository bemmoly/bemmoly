import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createMaintenanceReader,
  enterMaintenance,
  exitMaintenance,
  MAINTENANCE_FILE,
} from './state.ts';

const STATE = {
  reason: 'update',
  message: 'Bemmoly is updating.',
  step: null,
  startedAt: '2026-10-08T00:00:00.000Z',
} as const;

/** Writes and removes the file directly, as the updater does from its own container. */
async function otherProcess() {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'bemmoly-maintenance-'));
  const file = path.join(dataDir, MAINTENANCE_FILE);
  return {
    dataDir,
    start: () => writeFile(file, JSON.stringify(STATE)),
    end: () => rm(file, { force: true }),
  };
}

describe('the maintenance reader', () => {
  it('sees maintenance end at once, even inside its cache window', async () => {
    const other = await otherProcess();
    const read = createMaintenanceReader(other.dataDir, 60_000);
    await other.start();
    expect(await read()).toMatchObject({ reason: 'update' });
    await other.end();
    expect(await read()).toBeNull();
  });

  it('caches the absence of maintenance, the common case', async () => {
    const other = await otherProcess();
    const read = createMaintenanceReader(other.dataDir, 60_000);
    expect(await read()).toBeNull();
    await other.start();
    expect(await read()).toBeNull();
    expect(await createMaintenanceReader(other.dataDir, 0)()).toMatchObject({ reason: 'update' });
  });

  it('sees maintenance this process starts and ends at once', async () => {
    const { dataDir } = await otherProcess();
    const read = createMaintenanceReader(dataDir, 60_000);
    expect(await read()).toBeNull();
    await enterMaintenance(dataDir, { reason: 'restore', message: 'Restoring.', step: null });
    expect(await read()).toMatchObject({ reason: 'restore' });
    await exitMaintenance(dataDir);
    expect(await read()).toBeNull();
  });
});
