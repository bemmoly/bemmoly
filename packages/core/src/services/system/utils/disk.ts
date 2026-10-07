import { mkdir, statfs } from 'node:fs/promises';

export interface DiskSpace {
  freeBytes: number;
  totalBytes: number;
}

/** Free and total bytes of the filesystem holding `dir` (created when missing). */
export async function diskSpace(dir: string): Promise<DiskSpace> {
  await mkdir(dir, { recursive: true });
  const stats = await statfs(dir);
  return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
}

export const MIN_BACKUP_HEADROOM_BYTES = 256 * 1024 * 1024;

/** The guard of §18: at least twice the previous backup's size must be free. */
export function requiredBackupSpace(previousSizeBytes: number | null): number {
  return Math.max(MIN_BACKUP_HEADROOM_BYTES, 2 * (previousSizeBytes ?? 0));
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
