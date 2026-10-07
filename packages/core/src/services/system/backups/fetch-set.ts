import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { createS3Bucket } from '../../../clients/s3-bucket.ts';
import type { SystemDependencies } from '../deps.ts';
import { readSetting } from '../settings.ts';
import { createDigestStream } from '../utils/hashing.ts';
import {
  createLocalDestination,
  createS3Destination,
  isSetName,
  resolveDestinations,
} from './destinations/index.ts';
import type { BackupDestination } from './destinations/types.ts';
import { createDecryptStream } from './encryption.ts';
import { MANIFEST_FILE, parseManifest, type BackupManifest, type BackupPart } from './manifest.ts';
import { createBackupRepository } from './repository.ts';

export interface SetSource {
  destination: BackupDestination;
  setName: string;
}

export class BackupIntegrityError extends Error {
  override readonly name = 'BackupIntegrityError';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fromS3Url(deps: SystemDependencies, ref: string): Promise<SetSource> {
  const url = new URL(ref);
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const setName = parts.pop() ?? '';
  const settings = await readSetting(deps.settings, 'system.backups.s3');
  if (!settings) {
    throw new ValidationError(
      'Restoring from S3 needs the S3 destination configured in Settings › Storage and backups',
    );
  }
  const bucket = (deps.s3 ?? createS3Bucket)({
    region: settings.region,
    bucket: url.host,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    forcePathStyle: settings.forcePathStyle,
    ...(settings.endpoint ? { endpoint: settings.endpoint } : {}),
  });
  return { destination: createS3Destination(bucket, parts.join('/')), setName };
}

/**
 * Finds a backup set from what an admin types: a backup id, a set name, a folder (or
 * its manifest.json) on this machine, or an s3:// URL.
 */
export async function resolveSetSource(deps: SystemDependencies, ref: string): Promise<SetSource> {
  if (ref.startsWith('s3://')) return fromS3Url(deps, ref);
  if (ref.startsWith('/')) {
    const folder = ref.endsWith(MANIFEST_FILE) ? path.dirname(ref) : ref.replace(/\/+$/, '');
    return {
      destination: createLocalDestination(path.dirname(folder)),
      setName: path.basename(folder),
    };
  }
  let setName = ref;
  if (UUID.test(ref)) {
    const record = await createBackupRepository(deps.sql).get(ref);
    if (!record) throw new NotFoundError(`No backup with id ${ref}`);
    setName = record.setName;
  }
  if (!isSetName(setName))
    throw new ValidationError(`"${ref}" is not a backup id, set name, path or s3:// URL`);
  for (const destination of await resolveDestinations(deps)) {
    if (await destination.exists(setName, MANIFEST_FILE)) return { destination, setName };
  }
  throw new NotFoundError(`Backup ${setName} was not found in any destination`);
}

export async function readSetManifest(source: SetSource): Promise<BackupManifest> {
  if (!(await source.destination.exists(source.setName, MANIFEST_FILE))) {
    throw new NotFoundError(
      `${source.destination.describe(source.setName)} has no ${MANIFEST_FILE}; the set is incomplete`,
    );
  }
  return parseManifest(await text(await source.destination.read(source.setName, MANIFEST_FILE)));
}

/**
 * Streams one part to `target`, verifying the stored checksum, decrypting
 * when needed and verifying the plain checksum. Throws BackupIntegrityError on mismatch.
 */
export async function fetchPart(input: {
  source: SetSource;
  part: BackupPart;
  passphrase: string | undefined;
  /** Where the plain bytes go; omitted, the part is only verified. */
  target?: string;
}): Promise<void> {
  const { source, part } = input;
  const encrypted = part.file.endsWith('.enc');
  if (encrypted && !input.passphrase) {
    throw new ValidationError(
      'This backup is encrypted: BEMMOLY_BACKUP_PASSPHRASE from the original .env is required',
    );
  }
  const stored = createDigestStream();
  const plain = createDigestStream();
  const body = await source.destination.read(source.setName, part.file);
  const sink = input.target
    ? createWriteStream(input.target, { mode: 0o640 })
    : new PassThrough().resume();
  if (encrypted && input.passphrase) {
    await pipeline(body, stored, createDecryptStream(input.passphrase), plain, sink);
  } else {
    await pipeline(body, stored, plain, sink);
  }
  if (stored.digest().sha256 !== part.sha256) {
    throw new BackupIntegrityError(`${part.file} does not match the checksum in the manifest`);
  }
  if (plain.digest().sha256 !== part.plainSha256) {
    throw new BackupIntegrityError(`${part.file} decrypts to different bytes than were backed up`);
  }
}
