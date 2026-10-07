// Fixtures for bemmoly-raw-sql-concatenation. `ruleid` lines must match; `ok` lines must not.
declare const sql: {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  unsafe(text: string, params?: unknown[]): Promise<unknown>;
  raw(text: string): unknown;
};
declare const db: { unsafe(text: string, params?: unknown[]): Promise<unknown> };
declare const projectId: string;
declare const table: string;

export async function unsafeExamples() {
  // ruleid: bemmoly-raw-sql-concatenation
  await db.unsafe('select * from issues where project_id = ' + projectId);
  // ruleid: bemmoly-raw-sql-concatenation
  await sql.unsafe(`delete from pages where space_id = '${projectId}'`);
  // ruleid: bemmoly-raw-sql-concatenation
  const text = 'SELECT id FROM users WHERE email = ' + projectId;
  // ruleid: bemmoly-raw-sql-concatenation
  const update = `update issues set title = '${projectId}' where id = 1`;
  // ruleid: bemmoly-raw-sql-concatenation
  sql.raw(`select * from ${table}`);
  // ruleid: bemmoly-raw-sql-concatenation
  const columns = `select ${table}.id, ${table}.title from ${table}`;
  return [text, update, columns];
}

export async function safeExamples() {
  // ok: bemmoly-raw-sql-concatenation
  await sql`select * from issues where project_id = ${projectId}`;
  // ok: bemmoly-raw-sql-concatenation
  await sql<{ id: string }[]>`select id from issues where project_id = ${projectId}`;
  // ok: bemmoly-raw-sql-concatenation
  await db.unsafe('select * from issues where project_id = $1', [projectId]);
  // ok: bemmoly-raw-sql-concatenation
  const label = 'Selected ' + projectId;
  // ok: bemmoly-raw-sql-concatenation
  const message = `update available: ${projectId}`;
  // ok: bemmoly-raw-sql-concatenation
  const plain = `select a project`;
  // ok: bemmoly-raw-sql-concatenation
  const notice = 'Update ' + projectId + ' set for review';
  // ok: bemmoly-raw-sql-concatenation
  const help = `Select ${projectId} from the list`;
  return [label, message, plain, notice, help];
}
