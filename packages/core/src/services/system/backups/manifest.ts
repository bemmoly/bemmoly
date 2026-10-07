import type { BackupKind } from '@bemmoly/shared';
import { z } from 'zod';

export const MANIFEST_FILE = 'manifest.json';
export const MANIFEST_FORMAT = 1;

const partSchema = z.object({
  file: z.string(),
  /** Bytes as stored (after encryption when encrypted). */
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** Bytes and checksum before encryption; equal to the stored values when not encrypted. */
  plainSizeBytes: z.number().int().nonnegative(),
  plainSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const backupManifestSchema = z.object({
  format: z.literal(MANIFEST_FORMAT),
  id: z.string(),
  setName: z.string(),
  kind: z.enum(['scheduled', 'manual', 'pre_upgrade']),
  createdAt: z.iso.datetime(),
  appVersion: z.string(),
  changelogTag: z.string().nullable(),
  modules: z.array(z.string()),
  database: partSchema.extend({
    format: z.literal('pg_dump-custom'),
    serverVersion: z.string(),
    /** Row counts taken in the dump's own snapshot; the restore drill compares against them. */
    rowCounts: z.record(z.string(), z.number().int().nonnegative()),
  }),
  attachments: z.object({
    mode: z.enum(['full', 'incremental']),
    /** Set names to extract in order, oldest first; ends with this set when it has files. */
    chain: z.array(z.string()),
    chainStartedAt: z.iso.datetime(),
    fileCount: z.number().int().nonnegative(),
    totalFileCount: z.number().int().nonnegative(),
    archive: partSchema.nullable(),
    index: z.string(),
  }),
  encryption: z
    .object({ algorithm: z.string(), kdf: z.literal('scrypt'), passphraseSource: z.string() })
    .nullable(),
  instructions: z.array(z.string()),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type BackupPart = z.infer<typeof partSchema>;

export interface ManifestInput {
  id: string;
  setName: string;
  kind: BackupKind;
  createdAt: Date;
  appVersion: string;
  changelogTag: string | null;
  modules: readonly string[];
  database: BackupPart & { serverVersion: string; rowCounts: Record<string, number> };
  attachments: {
    mode: 'full' | 'incremental';
    chain: readonly string[];
    chainStartedAt: Date;
    fileCount: number;
    totalFileCount: number;
    archive: BackupPart | null;
    index: string;
  };
  encryption: { algorithm: string } | null;
}

function restoreInstructions(input: ManifestInput): string[] {
  const steps = [
    'Keep /var/bemmoly/.env with this backup: it holds BEMMOLY_SECRET_KEY, which decrypts provider keys, SMTP passwords and SSO secrets stored in the database. This backup does not contain it.',
    `On the same machine: sudo bemmoly restore ${input.setName}`,
    `On a new machine: run the installer, copy .env into /var/bemmoly, copy this folder into /var/bemmoly/backups, then run: sudo bemmoly restore ${input.setName}`,
    `To inspect without replacing the workspace: sudo bemmoly restore --mount ${input.setName}`,
  ];
  if (input.encryption) {
    steps.push(
      'The parts are encrypted with BEMMOLY_BACKUP_PASSPHRASE from .env; the restore reads it from there.',
    );
  }
  if (input.attachments.mode === 'incremental') {
    steps.push(
      `Attachments are incremental: the restore also needs ${input.attachments.chain.slice(0, -1).join(', ') || 'no earlier sets'}.`,
    );
  }
  return steps;
}

/** The manifest written next to every backup's parts. */
export function buildManifest(input: ManifestInput): BackupManifest {
  return backupManifestSchema.parse({
    format: MANIFEST_FORMAT,
    id: input.id,
    setName: input.setName,
    kind: input.kind,
    createdAt: input.createdAt.toISOString(),
    appVersion: input.appVersion,
    changelogTag: input.changelogTag,
    modules: [...input.modules].sort(),
    database: { ...input.database, format: 'pg_dump-custom' },
    attachments: {
      ...input.attachments,
      chain: [...input.attachments.chain],
      chainStartedAt: input.attachments.chainStartedAt.toISOString(),
    },
    encryption: input.encryption
      ? {
          algorithm: input.encryption.algorithm,
          kdf: 'scrypt',
          passphraseSource: 'BEMMOLY_BACKUP_PASSPHRASE in /var/bemmoly/.env',
        }
      : null,
    instructions: restoreInstructions(input),
  });
}

/** Total stored bytes of a backup set. */
export function manifestSize(manifest: BackupManifest): number {
  return manifest.database.sizeBytes + (manifest.attachments.archive?.sizeBytes ?? 0);
}

export function parseManifest(json: string): BackupManifest {
  return backupManifestSchema.parse(JSON.parse(json));
}

/** Set names sort by time: bemmoly-20261007-020000-scheduled-1a2b3c4d. */
export function setNameFor(id: string, kind: BackupKind, createdAt: Date): string {
  const stamp = createdAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\.\d+Z$/, '');
  return `bemmoly-${stamp}-${kind.replace('_', '-')}-${id.replace(/-/g, '').slice(-8)}`;
}
