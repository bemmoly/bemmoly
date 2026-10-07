import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ConflictError, UPDATER_LOCK_FILE, UPDATER_LOCK_STALE_MS } from '@bemmoly/shared';

/**
 * True while the updater holds its lock: an update or rollback is swapping the app
 * container and may be restoring the database itself.
 */
export async function updaterOperationRunning(dataDir: string, now = Date.now()): Promise<boolean> {
  try {
    const { mtimeMs } = await stat(path.join(dataDir, UPDATER_LOCK_FILE));
    return now - mtimeMs < UPDATER_LOCK_STALE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** A restore started now would race the updater for the database and the container. */
export async function assertNoUpdaterOperation(dataDir: string): Promise<void> {
  if (await updaterOperationRunning(dataDir)) {
    throw new ConflictError(
      'An update or rollback is in progress; restore once it has finished (Settings › Updates or `bemmoly status` shows it)',
    );
  }
}
