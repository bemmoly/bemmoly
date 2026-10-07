import type { BackupLocation } from '@bemmoly/shared';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDigestStream, type Digest } from '../utils/hashing.ts';
import { ATTACHMENTS_INDEX } from './attachments.ts';
import type { BackupDestination } from './destinations/types.ts';
import { createEncryptStream } from './encryption.ts';
import type { BackupPart } from './manifest.ts';
import { MANIFEST_FILE, type BackupManifest } from './manifest.ts';

export const DATABASE_PART = 'database.dump';
export const ENCRYPTED_SUFFIX = '.enc';

export interface StagedPart {
  /** Plain file in the staging folder. */
  path: string;
  name: string;
  digest: Digest;
}

export interface StagedSet {
  setName: string;
  database: StagedPart;
  attachments: StagedPart | null;
  index: string;
}

export interface StoredVariant {
  encrypted: boolean;
  database: BackupPart;
  attachments: BackupPart | null;
}

export class MissingPassphraseError extends Error {
  override readonly name = 'MissingPassphraseError';
  constructor() {
    super(
      'BEMMOLY_BACKUP_PASSPHRASE is not set: off-box and encrypted backups need it. Add it to /var/bemmoly/.env (the installer generates one).',
    );
  }
}

async function encryptPart(
  part: StagedPart,
  passphrase: string,
): Promise<{ path: string; part: BackupPart }> {
  const target = `${part.path}${ENCRYPTED_SUFFIX}`;
  const digest = createDigestStream();
  await pipeline(
    createReadStream(part.path),
    createEncryptStream(passphrase),
    digest,
    createWriteStream(target),
  );
  const stored = digest.digest();
  return {
    path: target,
    part: {
      file: `${part.name}${ENCRYPTED_SUFFIX}`,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      plainSizeBytes: part.digest.sizeBytes,
      plainSha256: part.digest.sha256,
    },
  };
}

const plainPart = (part: StagedPart): BackupPart => ({
  file: part.name,
  sizeBytes: part.digest.sizeBytes,
  sha256: part.digest.sha256,
  plainSizeBytes: part.digest.sizeBytes,
  plainSha256: part.digest.sha256,
});

export interface StoreResult {
  locations: BackupLocation[];
  variants: Map<BackupDestination, StoredVariant>;
}

/**
 * Writes the parts to every destination: encrypted when the destination is off-box or
 * local encryption is on, encrypted once per backup. The manifest is written last, so a
 * set without manifest.json is incomplete and ignored.
 */
export async function storeSet(input: {
  staged: StagedSet;
  destinations: readonly BackupDestination[];
  encryptLocal: boolean;
  passphrase: string | undefined;
  manifestFor: (variant: StoredVariant) => BackupManifest;
}): Promise<StoreResult> {
  const { staged } = input;
  const needsEncryption = (destination: BackupDestination) =>
    destination.offBox || input.encryptLocal;
  let encrypted:
    | {
        database: { path: string; part: BackupPart };
        attachments: { path: string; part: BackupPart } | null;
      }
    | undefined;
  if (input.destinations.some(needsEncryption)) {
    if (!input.passphrase) throw new MissingPassphraseError();
    encrypted = {
      database: await encryptPart(staged.database, input.passphrase),
      attachments: staged.attachments
        ? await encryptPart(staged.attachments, input.passphrase)
        : null,
    };
  }

  const plain = {
    variant: {
      encrypted: false,
      database: plainPart(staged.database),
      attachments: staged.attachments ? plainPart(staged.attachments) : null,
    } satisfies StoredVariant,
    database: staged.database.path,
    attachments: staged.attachments?.path ?? null,
  };
  const sealed = encrypted && {
    variant: {
      encrypted: true,
      database: encrypted.database.part,
      attachments: encrypted.attachments?.part ?? null,
    } satisfies StoredVariant,
    database: encrypted.database.path,
    attachments: encrypted.attachments?.path ?? null,
  };

  const locations: BackupLocation[] = [];
  const variants = new Map<BackupDestination, StoredVariant>();
  for (const destination of input.destinations) {
    const chosen = needsEncryption(destination) && sealed ? sealed : plain;
    const { variant } = chosen;
    await destination.write(
      staged.setName,
      variant.database.file,
      createReadStream(chosen.database),
    );
    if (variant.attachments && chosen.attachments) {
      await destination.write(
        staged.setName,
        variant.attachments.file,
        createReadStream(chosen.attachments),
      );
    }
    await destination.write(staged.setName, ATTACHMENTS_INDEX, Readable.from([staged.index]));
    const manifest = input.manifestFor(variant);
    await destination.write(
      staged.setName,
      MANIFEST_FILE,
      Readable.from([`${JSON.stringify(manifest, null, 2)}\n`]),
    );
    variants.set(destination, variant);
    locations.push({
      destination: destination.kind,
      location: destination.describe(staged.setName),
    });
  }
  return { locations, variants };
}
