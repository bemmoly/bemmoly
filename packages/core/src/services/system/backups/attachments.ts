import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const ATTACHMENTS_ARCHIVE = 'attachments.tar';
/** The disk object store's root for attachments, under BEMMOLY_DATA_DIR. */
export const ATTACHMENTS_SUBDIR = 'attachments';
export const ATTACHMENTS_INDEX = 'attachments.index.json';
/** A chain longer than this is cut with a full copy even inside the month. */
const MAX_CHAIN = 45;

export function attachmentsDir(dataDir: string): string {
  return path.join(dataDir, ATTACHMENTS_SUBDIR);
}

/** Relative path → size of every attachment file present now. */
export type AttachmentIndex = Map<string, number>;

/**
 * Walks the content-addressed attachment store. Files are written before their row
 * exists (§18), so taking the database dump first and listing files second means every
 * referenced file is in the list. Temporary files are skipped.
 */
export async function scanAttachments(root: string): Promise<AttachmentIndex> {
  const index: AttachmentIndex = new Map();
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || /\.(partial|tmp)$/.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) index.set(path.relative(root, full), (await stat(full)).size);
    }
  };
  await walk(root);
  return index;
}

export function serializeIndex(index: AttachmentIndex): string {
  return JSON.stringify({ files: [...index.entries()].sort(([a], [b]) => a.localeCompare(b)) });
}

export function parseIndex(json: string): AttachmentIndex {
  const parsed = JSON.parse(json) as { files?: [string, number][] };
  return new Map(parsed.files ?? []);
}

export interface PreviousBackup {
  id: string;
  setName: string;
  /** The sets its attachments need, oldest first. */
  chain: readonly string[];
  /** When the full copy that starts the chain was taken. */
  chainStartedAt: Date;
  index: AttachmentIndex;
}

export interface AttachmentPlan {
  mode: 'full' | 'incremental';
  files: string[];
  /** Sets to extract on restore, oldest first. */
  chain: string[];
  baseBackupId: string | null;
  bytes: number;
  chainStartedAt: Date;
}

const monthOf = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

/**
 * Full copy for the first backup, for every pre-upgrade backup, at the first backup of
 * each month and when a chain grows too long; otherwise only files added since the
 * previous backup.
 */
export function planAttachments(input: {
  setName: string;
  current: AttachmentIndex;
  previous: PreviousBackup | null;
  forceFull: boolean;
  now: Date;
}): AttachmentPlan {
  const { previous, current } = input;
  const sum = (files: string[]) =>
    files.reduce((total, file) => total + (current.get(file) ?? 0), 0);
  const full =
    input.forceFull ||
    !previous ||
    monthOf(previous.chainStartedAt) !== monthOf(input.now) ||
    previous.chain.length >= MAX_CHAIN;
  if (full) {
    const files = [...current.keys()].sort();
    return {
      mode: 'full',
      files,
      chain: files.length > 0 ? [input.setName] : [],
      baseBackupId: null,
      bytes: sum(files),
      chainStartedAt: input.now,
    };
  }
  const files = [...current.keys()].filter((file) => !previous.index.has(file)).sort();
  return {
    mode: 'incremental',
    files,
    chain: files.length > 0 ? [...previous.chain, input.setName] : [...previous.chain],
    baseBackupId: previous.id,
    bytes: sum(files),
    chainStartedAt: previous.chainStartedAt,
  };
}
