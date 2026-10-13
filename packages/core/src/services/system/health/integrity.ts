import type { SystemCheck } from '@bemmoly/shared';
import type { SqlClient } from '../../../clients/postgres.ts';

/*
 * Rows whose target is gone, as each module counts them. A module that keeps polymorphic
 * references (target_kind, target_id) ships a view named integrity_orphans_<module> with one
 * row per table: (table_name, orphans). The kernel finds the views by name, so it never
 * names a module's tables. Delete triggers keep the counts at zero; anything else is a bug.
 */
const VIEW_NAME = /^integrity_orphans_[a-z][a-z0-9_]*$/;

interface OrphanCount {
  table: string;
  orphans: number;
}

export async function countOrphans(sql: SqlClient): Promise<OrphanCount[]> {
  const views = await sql<{ viewname: string }[]>`
    select viewname from pg_views
    where schemaname = current_schema() and viewname like 'integrity\\_orphans\\_%'
    order by viewname`;
  const counts: OrphanCount[] = [];
  for (const { viewname } of views) {
    if (!VIEW_NAME.test(viewname)) continue;
    const rows = await sql<{ table_name: string; orphans: string | number }[]>`
      select table_name, orphans from ${sql(viewname)}`;
    for (const row of rows) counts.push({ table: row.table_name, orphans: Number(row.orphans) });
  }
  return counts;
}

export async function checkIntegrity(sql: SqlClient): Promise<SystemCheck> {
  const name = 'Data integrity';
  try {
    const found = (await countOrphans(sql)).filter((count) => count.orphans > 0);
    if (found.length === 0) {
      return { id: 'integrity', name, status: 'ok', value: 'no orphaned rows', fix: null };
    }
    const total = found.reduce((sum, count) => sum + count.orphans, 0);
    const where = found.map((count) => `${count.table} ${count.orphans}`).join(', ');
    return {
      id: 'integrity',
      name,
      status: 'warn',
      value: `${total} orphaned rows · ${where}`,
      fix: {
        label: 'Report it',
        hint:
          'Some rows point at issues or pages that no longer exist. They are hidden and ' +
          'harmless, but they should not happen; please report this with the counts shown.',
      },
    };
  } catch {
    return {
      id: 'integrity',
      name,
      status: 'warn',
      value: 'not checked',
      fix: { label: 'Details', hint: 'The integrity views could not be read.' },
    };
  }
}
