import type { SqlClient } from '@bemmoly/core';
import { teamNames } from './names.ts';
import { SEED_EMAIL_DOMAIN } from './people.ts';

/*
 * --reset: empties every Pipelines and cloud table, then removes the people and teams the
 * seed made (addresses at acme.example; teams of the seed's names with no one else in them).
 * Nothing in Work, Docs or the rest of the kernel is touched.
 */

export async function hasCatalog(sql: SqlClient): Promise<boolean> {
  const [row] = await sql<
    { any: boolean }[]
  >`select exists (select 1 from pipeline_domains) as any`;
  return row?.any ?? false;
}

export async function resetDemo(sql: SqlClient): Promise<void> {
  const tables = await sql<{ name: string }[]>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and (table_name like 'pipeline\\_%' or table_name like 'cloud\\_%')`;
  if (tables.length > 0) {
    await sql`truncate ${sql(tables.map((t) => t.name))} cascade`;
  }
  const pattern = `%@${SEED_EMAIL_DOMAIN}`;
  await sql`
    delete from teams t
    where t.name = any(${teamNames()}::text[])
      and not exists (
        select 1 from team_members m join users u on u.id = m.user_id
        where m.team_id = t.id and u.email not like ${pattern})`;
  await sql`delete from users where email like ${pattern}
    and id not in (select u.id from users u join roles r on r.id = u.role_id where r.key = 'org_admin')`;
}
