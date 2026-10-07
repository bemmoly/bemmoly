import { ConflictError, UPDATER_LOCK_FILE } from '@bemmoly/shared';
import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SystemDependencies } from '../deps.ts';
import { restoreBackup } from '../backups/restore.ts';
import { updaterOperationRunning } from './updater-lock.ts';

async function dataDirWithLock(ageMs: number | null): Promise<string> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'updater-lock-'));
  if (ageMs === null) return dataDir;
  const lock = path.join(dataDir, UPDATER_LOCK_FILE);
  await mkdir(path.dirname(lock), { recursive: true });
  await writeFile(lock, '1 2026-10-08T00:00:00Z\n');
  const at = new Date(Date.now() - ageMs);
  await utimes(lock, at, at);
  return dataDir;
}

describe('the updater lock', () => {
  it('is held while the updater runs, and ignored once it is stale', async () => {
    expect(await updaterOperationRunning(await dataDirWithLock(null))).toBe(false);
    expect(await updaterOperationRunning(await dataDirWithLock(60_000))).toBe(true);
    expect(await updaterOperationRunning(await dataDirWithLock(3 * 3_600_000))).toBe(false);
  });

  it('refuses a restore unless the updater itself asks for it', async () => {
    const deps = {
      config: { dataDir: await dataDirWithLock(60_000) },
    } as unknown as SystemDependencies;
    await expect(restoreBackup(deps, 'bemmoly-20261008-020000-manual-1a2b3c4d')).rejects.toThrow(
      ConflictError,
    );
    // Past the lock check, the missing backup is what fails.
    await expect(
      restoreBackup(deps, 'bemmoly-20261008-020000-manual-1a2b3c4d', { asUpdater: true }),
    ).rejects.not.toThrow(ConflictError);
  });
});
