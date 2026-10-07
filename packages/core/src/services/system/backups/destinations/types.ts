import type { BackupDestinationKind } from '@bemmoly/shared';
import type { Readable } from 'node:stream';

/**
 * Where backup sets are written. One implementation per backend (local disk,
 * S3-compatible); adding one is one file plus one line in index.ts.
 */
export interface BackupDestination {
  readonly kind: BackupDestinationKind;
  /** Off-box destinations always receive encrypted parts. */
  readonly offBox: boolean;
  write(setName: string, file: string, body: Readable): Promise<void>;
  read(setName: string, file: string): Promise<Readable>;
  exists(setName: string, file: string): Promise<boolean>;
  /** Set names present at the destination. */
  listSets(): Promise<string[]>;
  remove(setName: string): Promise<void>;
  /** Human-readable location of a set, e.g. /var/bemmoly/backups/<set> or s3://bucket/<set>. */
  describe(setName: string): string;
}
