import type { SqlExecutor } from '@bemmoly/core';
import { decodeCursor, toPage } from '@bemmoly/core';
import type { z } from 'zod';
import type { EnvironmentClass, Tier } from '../../../../shared/common.ts';
import type { GateState } from '../../../../shared/promotions.ts';
import type {
  ChangeOutcome,
  ChangeRecord,
  ChangeRecordsPage,
  listChangeRecordsQuerySchema,
} from '../../../../shared/trains.ts';
import { iso, isoOrNull } from '../../utils/time.ts';
import { describeStoredGate } from './gates/index.ts';

/*
 * Change records (architecture §11) as auditors read them: one per finished promotion,
 * immutable, with who asked, who approved, every gate and its evidence, and the timings;
 * as JSON pages or one CSV for SOC 2 and ISO 27001 evidence.
 */

export type ChangeRecordsQuery = z.output<typeof listChangeRecordsQuerySchema>;

interface Row {
  id: string;
  promotion_id: string;
  application_id: string;
  application_key: string;
  application_name: string;
  tier: number;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  outcome: string;
  record: StoredRecord;
  created_at: string;
}

interface StoredRecord {
  release: { id: string; version: string; digests: Record<string, string> };
  requestedBy: { id: string; name: string } | null;
  approvals: Array<{
    id: string;
    user_id: string;
    name: string;
    requirement: string;
    decision: 'approved' | 'rejected';
    release_digest: string;
    comment: string | null;
    expires_at: string | null;
    created_at: string;
  }>;
  gates: Array<{
    gate: string;
    state: string;
    reason: string;
    evidence: Record<string, unknown>;
    recheck_at: string | null;
    evaluated_at: string;
  }>;
  timings: {
    requestedAt: string;
    approvedAt: string | null;
    startedAt: string | null;
    finishedAt: string;
  };
}

function toRecord(row: Row): ChangeRecord {
  const r = row.record;
  return {
    id: row.id,
    promotionId: row.promotion_id,
    application: {
      id: row.application_id,
      key: row.application_key,
      name: row.application_name,
      tier: row.tier as Tier,
    },
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: row.environment_class as EnvironmentClass,
    },
    release: r.release,
    outcome: row.outcome as ChangeOutcome,
    requestedBy: r.requestedBy,
    approvals: r.approvals.map((a) => ({
      id: a.id,
      user: { id: a.user_id, name: a.name, avatarUrl: null },
      requirement: a.requirement,
      decision: a.decision,
      releaseDigest: a.release_digest,
      comment: a.comment,
      expiresAt: isoOrNull(a.expires_at),
      createdAt: iso(a.created_at),
    })),
    gates: r.gates.map((g) => ({
      ...describeStoredGate(g.gate),
      state: g.state as GateState,
      reason: g.reason,
      evidence: g.evidence,
      recheckAt: isoOrNull(g.recheck_at),
      evaluatedAt: iso(g.evaluated_at),
    })),
    timings: {
      requestedAt: iso(r.timings.requestedAt),
      approvedAt: isoOrNull(r.timings.approvedAt),
      startedAt: isoOrNull(r.timings.startedAt),
      finishedAt: iso(r.timings.finishedAt),
    },
    createdAt: iso(row.created_at),
  };
}

async function rows(sql: SqlExecutor, query: ChangeRecordsQuery, limit: number): Promise<Row[]> {
  const after = decodeCursor(query.cursor);
  return sql<Row[]>`
    select c.id, c.promotion_id, a.id as application_id, a.key as application_key,
      a.name as application_name, a.tier, e.id as environment_id, e.key as environment_key,
      e.name as environment_name, e.class as environment_class, c.outcome, c.record, c.created_at
    from pipeline_change_records c
    join pipeline_applications a on a.id = c.application_id
    join pipeline_environments e on e.id = c.environment_id
    where true
      ${query.application ? sql`and a.key = ${query.application}` : sql``}
      ${query.environment ? sql`and e.key = ${query.environment}` : sql``}
      ${query.from ? sql`and c.created_at >= ${query.from}::timestamptz` : sql``}
      ${query.to ? sql`and c.created_at <= ${query.to}::timestamptz` : sql``}
      ${after ? sql`and c.id < ${after}::uuid` : sql``}
    order by c.id desc limit ${limit}`;
}

export async function listChangeRecords(
  sql: SqlExecutor,
  query: ChangeRecordsQuery,
): Promise<ChangeRecordsPage> {
  const page = toPage(await rows(sql, query, query.limit + 1), query.limit);
  return { items: page.rows.map(toRecord), nextCursor: page.nextCursor };
}

const CSV_HEADER = [
  'record',
  'created_at',
  'application',
  'environment',
  'version',
  'outcome',
  'requested_by',
  'approved_by',
  'gates',
  'requested_at',
  'approved_at',
  'started_at',
  'finished_at',
];

const cell = (value: string | null | undefined) => {
  const text = value ?? '';
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Every record in the range as one CSV, newest first, up to 10,000 rows. */
export async function changeRecordsCsv(
  sql: SqlExecutor,
  query: ChangeRecordsQuery,
): Promise<string> {
  const lines = [CSV_HEADER.join(',')];
  for (const row of await rows(sql, { ...query, cursor: undefined }, 10_000)) {
    const record = toRecord(row);
    lines.push(
      [
        record.id,
        record.createdAt,
        record.application.key,
        record.environment.key,
        record.release.version,
        record.outcome,
        record.requestedBy?.name,
        record.approvals
          .filter((a) => a.decision === 'approved')
          .map((a) => a.user.name)
          .join('; '),
        record.gates.map((g) => `${g.label}: ${g.state}`).join('; '),
        record.timings.requestedAt,
        record.timings.approvedAt,
        record.timings.startedAt,
        record.timings.finishedAt,
      ]
        .map(cell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
