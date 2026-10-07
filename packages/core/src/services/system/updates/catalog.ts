import { ValidationError, type CatalogUploadResponse } from '@bemmoly/shared';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Actor } from '../../../contracts/authz.ts';
import { SYSTEM_CAPABILITY } from '../authorize.ts';
import type { SystemDependencies } from '../deps.ts';
import { createDigestStream } from '../utils/hashing.ts';

export const MAX_BUNDLE_BYTES = 8 * 1024 ** 3;
export const BUNDLE_FOLDER = 'updates';

function limit(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      seen += chunk.length;
      if (seen > maxBytes) {
        callback(new ValidationError(`The bundle is larger than ${maxBytes} bytes`));
        return;
      }
      callback(null, chunk);
    },
  });
}

/**
 * Stores an air-gapped release bundle in <data>/updates for the updater to load. The
 * app only stores it; verifying and loading the images is the updater's job.
 */
export async function storeCatalogUpload(
  deps: SystemDependencies,
  actor: Actor,
  filename: string,
  body: Readable,
  maxBytes = MAX_BUNDLE_BYTES,
): Promise<CatalogUploadResponse> {
  await deps.authorize(actor, SYSTEM_CAPABILITY, { kind: 'workspace' });
  const folder = path.join(deps.config.dataDir, BUNDLE_FOLDER);
  await mkdir(folder, { recursive: true, mode: 0o750 });
  const target = path.join(folder, path.basename(filename));
  const partial = `${target}.partial`;
  const digest = createDigestStream();
  try {
    await pipeline(body, limit(maxBytes), digest, createWriteStream(partial, { mode: 0o640 }));
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
  const { sizeBytes, sha256 } = digest.digest();
  deps.logger.info({ actor: actor.id, filename, sizeBytes, sha256 }, 'release bundle stored');
  return {
    filename: path.basename(target),
    sizeBytes,
    sha256,
    storedAt: (deps.now?.() ?? new Date()).toISOString(),
  };
}
