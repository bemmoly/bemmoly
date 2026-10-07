import type { PgTools } from '../../clients/pg-tools.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { S3Bucket, S3BucketConfig } from '../../clients/s3-bucket.ts';
import type { TarTool } from '../../clients/tar.ts';
import type { UpdaterClient } from '../../clients/updater.ts';
import type { Logger } from '../../config/logger.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { RealtimePublisher } from '../../contracts/realtime.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { BackupDestination } from './backups/destinations/types.ts';

export interface SystemConfig {
  databaseUrl: string;
  dataDir: string;
  backupDir: string;
  appVersion: string;
  role: 'all' | 'api' | 'worker';
  publicUrl: string;
  /** Encrypts off-box copies; absent means off-box destinations are refused. */
  backupPassphrase?: string;
}

/** Counts audit rows since an instant, for the restore rollback's discard summary. */
export interface AuditActivity {
  countSince(since: Date): Promise<{ changes: number; people: number }>;
}

/** Whether outbound email is configured, for the SMTP health check. */
export interface EmailConfigurationProbe {
  describe(): Promise<{ configured: boolean; value: string }>;
}

/** What rollback planning needs to know about a changeset applied after a tag. */
export interface ChangesetTraits {
  module: string;
  id: string;
  hasDown: boolean;
  irreversible: boolean;
}

/**
 * The changelog runner as the system service uses it: through its command line
 * (`db tag`, `db rollback --to-tag … --dry-run`, `db update`, `db history`), which the
 * updater also calls. Tags are the outgoing version, e.g. "1.2.4".
 */
export interface ChangelogProbe {
  /** Changesets applied after `tag`, newest first; null when no changeset carries it. */
  changesSince(tag: string): Promise<ChangesetTraits[] | null>;
  /** The newest tag, for the backup manifest. */
  latestTag(): Promise<string | null>;
  /** Applies pending changesets; resolves to how many ran. */
  update(): Promise<number>;
}

/** The producer side of the job queue (the kernel's pg-boss JobQueue.enqueue). */
export interface JobEnqueuer {
  enqueue(
    name: string,
    payload: object,
    options?: { key?: string; singleton?: boolean; startAfter?: Date },
  ): Promise<string | null>;
}

export interface SystemDependencies {
  config: SystemConfig;
  sql: SqlClient;
  pgTools: PgTools;
  tar: TarTool;
  logger: Logger;
  authorize: Authorize;
  /** Enabled module ids, written into every manifest. */
  modules: () => readonly string[];
  settings?: SettingsService;
  events?: EventBus;
  jobs?: JobEnqueuer;
  changelog?: ChangelogProbe;
  /** Invalidates the backups list in open browsers. */
  realtime?: RealtimePublisher;
  audit?: AuditActivity;
  email?: EmailConfigurationProbe;
  updater?: UpdaterClient;
  /** Builds the S3 client; tests replace it with a fake object store. */
  s3?: (config: S3BucketConfig) => S3Bucket;
  /**
   * Called when a backup passes verification. The host wires it to the telemetry
   * metric: getMetrics().backups.recordGoodBackup(finishedAt).
   */
  onGoodBackup?: (finishedAt: Date) => void;
  /** Replaces every destination; tests pass a fake object store. */
  destinations?: () => Promise<BackupDestination[]>;
  now?: () => Date;
}

export const systemActorId = 'system';
