import type { AiFeedback, AiInsightKind } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';

/** One ai_insights row as the service reads it. */
export interface InsightRow {
  id: string;
  targetKind: string;
  targetId: string;
  kind: AiInsightKind;
  inputHash: string;
  content: unknown;
  status: 'ready' | 'refreshing' | 'failed';
  error: string | null;
  runId: string | null;
  feedback: AiFeedback | null;
  generatedAt: Date | null;
  updatedAt: Date;
}

interface RawRow {
  id: string;
  target_kind: string;
  target_id: string;
  kind: AiInsightKind;
  input_hash: string;
  content: unknown;
  status: InsightRow['status'];
  error: string | null;
  run_id: string | null;
  feedback: AiFeedback | null;
  generated_at: Date | string | null;
  updated_at: Date | string;
}

const toRow = (raw: RawRow): InsightRow => ({
  id: raw.id,
  targetKind: raw.target_kind,
  targetId: raw.target_id,
  kind: raw.kind,
  inputHash: raw.input_hash,
  content: raw.content,
  status: raw.status,
  error: raw.error,
  runId: raw.run_id,
  feedback: raw.feedback,
  generatedAt: raw.generated_at === null ? null : new Date(raw.generated_at),
  updatedAt: new Date(raw.updated_at),
});

const COLUMNS =
  'id, target_kind, target_id, kind, input_hash, content, status, error, run_id, feedback, generated_at, updated_at';

/** The ai_insights table: one row per target and kind, upserted on every regeneration. */
export function createInsightStore(sql: SqlExecutor) {
  return {
    async find(targetKind: string, targetId: string, kind: AiInsightKind) {
      const rows = await sql<RawRow[]>`
        select ${sql.unsafe(COLUMNS)} from ai_insights
        where target_kind = ${targetKind} and target_id = ${targetId} and kind = ${kind}`;
      return rows[0] ? toRow(rows[0]) : null;
    },

    async findById(id: string) {
      const rows = await sql<RawRow[]>`
        select ${sql.unsafe(COLUMNS)} from ai_insights where id = ${id}`;
      return rows[0] ? toRow(rows[0]) : null;
    },

    /** Stores a fresh result; feedback belongs to the old text, so it is cleared. */
    async saveReady(input: {
      targetKind: string;
      targetId: string;
      kind: AiInsightKind;
      inputHash: string;
      content: unknown;
      runId: string | null;
      generatedAt: Date;
    }): Promise<InsightRow> {
      const [raw] = await sql<RawRow[]>`
        insert into ai_insights
          (target_kind, target_id, kind, input_hash, content, status, error, run_id, feedback,
           generated_at, updated_at)
        values (
          ${input.targetKind}, ${input.targetId}, ${input.kind}, ${input.inputHash},
          ${JSON.stringify(input.content)}::jsonb, 'ready', null,
          (select id from ai_runs where id = ${input.runId}), null,
          ${input.generatedAt.toISOString()}::timestamptz, now())
        on conflict (target_kind, target_id, kind) do update set
          input_hash = excluded.input_hash,
          content = excluded.content,
          status = 'ready',
          error = null,
          run_id = excluded.run_id,
          feedback = null,
          generated_at = excluded.generated_at,
          updated_at = now()
        returning ${sql.unsafe(COLUMNS)}`;
      return toRow(raw!);
    },

    /** Records a failed regeneration and keeps the last good content to show meanwhile. */
    async saveFailed(input: {
      targetKind: string;
      targetId: string;
      kind: AiInsightKind;
      inputHash: string;
      error: string;
    }): Promise<InsightRow> {
      const [raw] = await sql<RawRow[]>`
        insert into ai_insights (target_kind, target_id, kind, input_hash, status, error)
        values (${input.targetKind}, ${input.targetId}, ${input.kind}, ${input.inputHash},
          'failed', ${input.error})
        on conflict (target_kind, target_id, kind) do update set
          input_hash = excluded.input_hash,
          status = 'failed',
          error = excluded.error,
          updated_at = now()
        returning ${sql.unsafe(COLUMNS)}`;
      return toRow(raw!);
    },

    /** "Not useful" lands on the insight and on the ai_runs row that wrote it. */
    async setFeedback(id: string, feedback: AiFeedback, runId: string | null): Promise<void> {
      await sql`update ai_insights set feedback = ${feedback} where id = ${id}`;
      if (runId) await sql`update ai_runs set feedback = ${feedback} where id = ${runId}`;
    },
  };
}

export type InsightStore = ReturnType<typeof createInsightStore>;
