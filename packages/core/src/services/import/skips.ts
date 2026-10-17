import type { SqlClient } from '../../clients/postgres.ts';

/*
 * The full list of what an import skipped and why, as CSV, beyond the first records the report
 * shows. Fields are quoted when they need it, and a leading =, +, - or @ is defused so a
 * spreadsheet never runs a record's text as a formula.
 */

const HEADER = ['Project or space', 'Kind', 'Record', 'Reason'];

export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export async function skipsCsv(sql: SqlClient, jobId: string): Promise<string> {
  const rows = await sql<
    { container: string | null; kind: string; source: string; reason: string }[]
  >`
    select coalesce(c.key, c.name, s.container_id) as container, s.kind, s.source, s.reason
    from import_skips s
    left join import_containers c on c.job_id = s.job_id and c.source_id = s.container_id
    where s.job_id = ${jobId}
    order by s.id`;
  const lines = [
    HEADER,
    ...rows.map((row) => [row.container ?? '', row.kind, row.source, row.reason]),
  ];
  return `${lines.map((line) => line.map(csvField).join(',')).join('\r\n')}\r\n`;
}
