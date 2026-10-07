import type { SqlClient } from '../../../clients/postgres.ts';
import type { AuditActivity } from '../deps.ts';

const ACTOR_COLUMNS = ['actor_user_id', 'actor_id', 'user_id'] as const;

/**
 * Counts audit rows since an instant straight from audit_log, for wiring that has no
 * audit service yet. It reads the table's columns first and throws when the table is
 * not there, so the rollback dialog shows no count rather than a wrong one.
 */
export function createSqlAuditActivity(sql: SqlClient): AuditActivity {
  return {
    async countSince(since) {
      const columns = await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = 'audit_log'`;
      const names = new Set(columns.map((column) => column.column_name));
      const actor = ACTOR_COLUMNS.find((column) => names.has(column));
      if (!names.has('created_at') || !actor) throw new Error('audit_log is not available');
      const [row] = await sql<{ changes: string; people: string }[]>`
        select count(*)::text as changes, count(distinct ${sql(actor)})::text as people
        from audit_log where created_at > ${since}`;
      return { changes: Number(row?.changes ?? 0), people: Number(row?.people ?? 0) };
    },
  };
}
