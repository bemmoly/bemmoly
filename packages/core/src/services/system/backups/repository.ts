import type {
  Backup,
  BackupKind,
  BackupLocation,
  BackupStatus,
  BackupVerificationState,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { BackupManifest } from './manifest.ts';

export interface BackupRecord {
  id: string;
  kind: BackupKind;
  status: BackupStatus;
  setName: string;
  appVersion: string;
  changelogTag: string | null;
  scheduledFor: Date | null;
  attachmentMode: 'full' | 'incremental';
  baseBackupId: string | null;
  encrypted: boolean;
  sizeBytes: number;
  locations: BackupLocation[];
  manifest: BackupManifest | null;
  verificationState: BackupVerificationState;
  verificationMessage: string | null;
  verifiedAt: Date | null;
  drilledAt: Date | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * The pool is wrapped by Drizzle (clients/postgres.ts): timestamps arrive as
 * strings and must be bound as text, and JSON is bound as text cast to jsonb.
 */
type Timestamp = string | Date;

const at = (value: Date | null) => (value === null ? null : value.toISOString());
const jsonb = (value: unknown) => JSON.stringify(value);

export function toDate(value: Timestamp): Date;
export function toDate(value: Timestamp | null): Date | null;
export function toDate(value: Timestamp | null): Date | null {
  return value === null ? null : new Date(value);
}

interface Row {
  id: string;
  kind: BackupKind;
  status: BackupStatus;
  set_name: string;
  app_version: string;
  changelog_tag: string | null;
  scheduled_for: Timestamp | null;
  attachment_mode: 'full' | 'incremental';
  base_backup_id: string | null;
  encrypted: boolean;
  size_bytes: string | number;
  locations: BackupLocation[];
  manifest: BackupManifest | null;
  verification_state: BackupVerificationState;
  verification_message: string | null;
  verified_at: Timestamp | null;
  drilled_at: Timestamp | null;
  error: string | null;
  created_at: Timestamp;
  completed_at: Timestamp | null;
}

function toRecord(row: Row): BackupRecord {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    setName: row.set_name,
    appVersion: row.app_version,
    changelogTag: row.changelog_tag,
    scheduledFor: toDate(row.scheduled_for),
    attachmentMode: row.attachment_mode,
    baseBackupId: row.base_backup_id,
    encrypted: row.encrypted,
    sizeBytes: Number(row.size_bytes),
    locations: row.locations,
    manifest: row.manifest,
    verificationState: row.verification_state,
    verificationMessage: row.verification_message,
    verifiedAt: toDate(row.verified_at),
    drilledAt: toDate(row.drilled_at),
    error: row.error,
    createdAt: toDate(row.created_at),
    completedAt: toDate(row.completed_at),
  };
}

/** The API shape of Settings › Storage and backups. */
export function toBackupDto(record: BackupRecord): Backup {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    appVersion: record.appVersion,
    changelogTag: record.changelogTag,
    sizeBytes: record.sizeBytes,
    attachmentMode: record.attachmentMode,
    baseBackupId: record.baseBackupId,
    encrypted: record.encrypted,
    locations: record.locations,
    verification: {
      state: record.verificationState,
      checkedAt: (record.drilledAt ?? record.verifiedAt)?.toISOString() ?? null,
      message: record.verificationMessage,
    },
    error: record.error,
  };
}

export interface NewBackup {
  id?: string;
  kind: BackupKind;
  setName: string;
  appVersion: string;
  changelogTag: string | null;
  scheduledFor: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

export function createBackupRepository(sql: SqlExecutor) {
  return {
    async insertRunning(input: NewBackup): Promise<BackupRecord> {
      const [row] = await sql<Row[]>`
        insert into backups (id, kind, set_name, app_version, changelog_tag, scheduled_for, created_by, created_at)
        values (coalesce(${input.id ?? null}::uuid, uuidv7()), ${input.kind}, ${input.setName},
          ${input.appVersion}, ${input.changelogTag}, ${at(input.scheduledFor)}::timestamptz,
          ${input.createdBy}, ${at(input.createdAt)}::timestamptz)
        returning *`;
      if (!row) throw new Error('insert into backups returned no row');
      return toRecord(row);
    },
    async markSucceeded(
      id: string,
      values: {
        manifest: BackupManifest;
        locations: BackupLocation[];
        attachmentMode: 'full' | 'incremental';
        baseBackupId: string | null;
        encrypted: boolean;
        sizeBytes: number;
        databaseBytes: number;
        attachmentsBytes: number;
        verifiedAt: Date;
        completedAt: Date;
      },
    ): Promise<void> {
      await sql`
        update backups set status = 'succeeded', manifest = ${jsonb(values.manifest)}::jsonb,
          locations = ${jsonb(values.locations)}::jsonb, attachment_mode = ${values.attachmentMode},
          base_backup_id = ${values.baseBackupId}, encrypted = ${values.encrypted},
          size_bytes = ${values.sizeBytes}, database_bytes = ${values.databaseBytes},
          attachments_bytes = ${values.attachmentsBytes}, verification_state = 'listed',
          verified_at = ${at(values.verifiedAt)}::timestamptz,
          completed_at = ${at(values.completedAt)}::timestamptz, updated_at = now()
        where id = ${id}`;
    },
    async markFailed(id: string, error: string, failedAt: Date): Promise<void> {
      await sql`
        update backups set status = 'failed', error = ${error.slice(0, 2_000)},
          completed_at = ${failedAt.toISOString()}::timestamptz, updated_at = now()
        where id = ${id}`;
    },
    async setVerification(
      id: string,
      state: BackupVerificationState,
      message: string | null,
      checkedAt: Date,
      drilled: boolean,
    ): Promise<void> {
      const when = checkedAt.toISOString();
      await sql`
        update backups set verification_state = ${state}, verification_message = ${message},
          verified_at = ${when}::timestamptz,
          drilled_at = case when ${drilled} then ${when}::timestamptz else drilled_at end,
          updated_at = now()
        where id = ${id}`;
    },
    async markPruned(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      await sql`update backups set status = 'pruned', updated_at = now() where id = any(${ids as string[]}::uuid[]) and status = 'succeeded'`;
      await sql`delete from backups where id = any(${ids as string[]}::uuid[]) and status = 'failed'`;
    },
    async get(id: string): Promise<BackupRecord | null> {
      const [row] = await sql<Row[]>`select * from backups where id = ${id}`;
      return row ? toRecord(row) : null;
    },
    async findBySetName(setName: string): Promise<BackupRecord | null> {
      const [row] = await sql<Row[]>`select * from backups where set_name = ${setName}`;
      return row ? toRecord(row) : null;
    },
    /** Newest first, keyset-paginated by id (UUIDv7 is time-ordered). */
    async list(options: {
      limit: number;
      cursor?: string;
      kind?: BackupKind;
    }): Promise<BackupRecord[]> {
      const rows = await sql<Row[]>`
        select * from backups
        where status <> 'pruned'
          ${options.cursor ? sql`and id < ${options.cursor}` : sql``}
          ${options.kind ? sql`and kind = ${options.kind}` : sql``}
        order by id desc
        limit ${options.limit}`;
      return rows.map(toRecord);
    },
    async all(): Promise<BackupRecord[]> {
      const rows = await sql<
        Row[]
      >`select * from backups where status <> 'pruned' order by id desc`;
      return rows.map(toRecord);
    },
    async latest(
      filter: { status?: BackupStatus; kind?: BackupKind } = {},
    ): Promise<BackupRecord | null> {
      const [row] = await sql<Row[]>`
        select * from backups where true
          ${filter.status ? sql`and status = ${filter.status}` : sql``}
          ${filter.kind ? sql`and kind = ${filter.kind}` : sql``}
        order by created_at desc limit 1`;
      return row ? toRecord(row) : null;
    },
    async lastScheduledFor(): Promise<Date | null> {
      const [row] = await sql<{ slot: Timestamp | null }[]>`
        select max(scheduled_for) as slot from backups where status <> 'failed'`;
      return toDate(row?.slot ?? null);
    },
  };
}

export type BackupRepository = ReturnType<typeof createBackupRepository>;
