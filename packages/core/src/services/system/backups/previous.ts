import { text } from 'node:stream/consumers';
import { ATTACHMENTS_INDEX, parseIndex, type PreviousBackup } from './attachments.ts';
import type { BackupDestination } from './destinations/types.ts';
import type { BackupRepository } from './repository.ts';

/**
 * The newest good backup and its attachment index, read from the first destination
 * that still has it. Null starts a new chain with a full copy.
 */
export async function loadPreviousBackup(
  repository: BackupRepository,
  destinations: readonly BackupDestination[],
): Promise<PreviousBackup | null> {
  const record = await repository.latest({ status: 'succeeded' });
  if (!record?.manifest) return null;
  for (const destination of destinations) {
    if (!(await destination.exists(record.setName, ATTACHMENTS_INDEX))) continue;
    const index = parseIndex(await text(await destination.read(record.setName, ATTACHMENTS_INDEX)));
    return {
      id: record.id,
      setName: record.setName,
      chain: record.manifest.attachments.chain,
      chainStartedAt: new Date(record.manifest.attachments.chainStartedAt),
      index,
    };
  }
  return null;
}
