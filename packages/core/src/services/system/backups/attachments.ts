import type { ObjectStore } from '../../../contracts/object-store.ts';

export const ATTACHMENTS_ARCHIVE = 'attachments.tar';
/**
 * Every uploaded file's object key starts with this (Docs images, the workspace logo, Work
 * attachments). Index entries and archive paths are the key without it, whichever store
 * holds the bytes.
 */
export const ATTACHMENTS_PREFIX = 'attachments/';
export const ATTACHMENTS_INDEX = 'attachments.index.json';
/** A chain longer than this is cut with a full copy even inside the month. */
const MAX_CHAIN = 45;
const LIST_PAGE = 1_000;

/** Relative path → size of every attachment file present now. */
export type AttachmentIndex = Map<string, number>;

/**
 * Lists the content-addressed attachments in the object store, on disk or in S3. Files are
 * written before their row exists (§18), so taking the database dump first and listing
 * files second means every referenced file is in the list.
 */
export async function scanAttachments(store: ObjectStore): Promise<AttachmentIndex> {
  const index: AttachmentIndex = new Map();
  let cursor: string | undefined;
  do {
    const page = await store.list(ATTACHMENTS_PREFIX, {
      limit: LIST_PAGE,
      ...(cursor ? { cursor } : {}),
    });
    for (const item of page.items) {
      if (item.key.startsWith(ATTACHMENTS_PREFIX)) {
        index.set(item.key.slice(ATTACHMENTS_PREFIX.length), item.size);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
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
