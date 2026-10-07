import type { AuditEntry } from '@bemmoly/shared';

export const AUDIT_CSV_COLUMNS = [
  'id',
  'createdAt',
  'actorKind',
  'actorId',
  'actorUserId',
  'action',
  'targetKind',
  'targetId',
  'ip',
  'requestId',
  'aiPlanId',
  'before',
  'after',
] as const;

/** Spreadsheet apps execute cells that start with these; prefix them so they stay text. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function auditCsvHeader(): string {
  return `${AUDIT_CSV_COLUMNS.join(',')}\r\n`;
}

export function auditCsvRow(entry: AuditEntry): string {
  return `${AUDIT_CSV_COLUMNS.map((column) => csvCell(entry[column])).join(',')}\r\n`;
}

/** Streams the header and one line per entry. */
export async function* auditLogToCsv(entries: AsyncIterable<AuditEntry>): AsyncGenerator<string> {
  yield auditCsvHeader();
  for await (const entry of entries) yield auditCsvRow(entry);
}
