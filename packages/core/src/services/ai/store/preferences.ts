import type { SqlExecutor } from '../../../contracts/sql.ts';

export interface OverrideRow {
  promptId: string;
  template: string;
  baseVersion: number;
  updatedBy: string | null;
  updatedAt: string;
}

export async function listOverrides(sql: SqlExecutor): Promise<OverrideRow[]> {
  const rows = await sql<
    {
      prompt_id: string;
      template: string;
      base_version: number;
      updated_by: string | null;
      updated_at: string | Date;
    }[]
  >`select prompt_id, template, base_version, updated_by, updated_at from ai_prompt_overrides`;
  return rows.map((row) => ({
    promptId: row.prompt_id,
    template: row.template,
    baseVersion: row.base_version,
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function upsertOverride(
  sql: SqlExecutor,
  write: { promptId: string; template: string; baseVersion: number; updatedBy: string | null },
): Promise<void> {
  await sql`
    insert into ai_prompt_overrides (prompt_id, template, base_version, updated_by)
    values (${write.promptId}, ${write.template}, ${write.baseVersion}, ${write.updatedBy})
    on conflict (prompt_id) do update set template = excluded.template,
      base_version = excluded.base_version, updated_by = excluded.updated_by, updated_at = now()`;
}

export async function deleteOverride(sql: SqlExecutor, promptId: string): Promise<boolean> {
  const rows =
    await sql`delete from ai_prompt_overrides where prompt_id = ${promptId} returning id`;
  return rows.length > 0;
}

export async function listOptOuts(sql: SqlExecutor): Promise<string[]> {
  const rows = await sql<{ user_id: string }[]>`select user_id from ai_user_opt_outs`;
  return rows.map((row) => row.user_id);
}

export async function setOptOut(
  sql: SqlExecutor,
  userId: string,
  optedOut: boolean,
): Promise<void> {
  if (optedOut) {
    await sql`insert into ai_user_opt_outs (user_id) values (${userId}) on conflict do nothing`;
  } else {
    await sql`delete from ai_user_opt_outs where user_id = ${userId}`;
  }
}

/** Display names of active people, for name redaction. */
export async function personNames(sql: SqlExecutor): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select distinct name from users where status = 'active' and name <> '' limit 5000`;
  return rows.map((row) => row.name);
}
