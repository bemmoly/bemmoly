import type { SqlClient } from '@bemmoly/core';
import { teamNames } from './names.ts';
import { SEED_EMAIL_DOMAIN } from './people.ts';

/*
 * --reset: empties every Pipelines and cloud table, then removes the people and teams the
 * seed made (addresses at acme.example; teams of the seed's names with no one else in them).
 * Nothing in Work, Docs or the rest of the kernel is touched.
 */

/**
 * The hosts a Postgres URL connects to, as libpq reads them: a host query parameter wins,
 * several hosts are comma separated, and an empty host means the default unix socket.
 */
export function databaseHosts(url: string): string[] {
  const query = url.includes('?') ? new URLSearchParams(url.slice(url.indexOf('?') + 1)) : null;
  const authority = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#]*)/i.exec(url)?.[1] ?? '';
  const listed = query?.get('host') ?? decodeURIComponent(authority);
  return listed
    .split(',')
    .map((host) =>
      host.startsWith('[')
        ? host.slice(1, host.indexOf(']'))
        : host.startsWith('/')
          ? host
          : host.replace(/:\d+$/, ''),
    );
}

const isLocalHost = (host: string) =>
  host === '' ||
  host.startsWith('/') ||
  host === 'localhost' ||
  host === '::1' ||
  /^127(\.\d{1,3}){3}$/.test(host);

/**
 * --reset empties tables wholesale, so it runs only against a database on this machine (a
 * dev install, or the Testcontainers Postgres the e2e starts on localhost) unless the operator
 * says --force. Returns the sentence to refuse with, or null.
 */
export function resetRefusal(url: string, force: boolean): string | null {
  if (force) return null;
  const remote = databaseHosts(url).filter((host) => !isLocalHost(host));
  if (remote.length === 0) return null;
  return `--reset empties every Pipelines and cloud table, and the database is on ${remote.join(', ')}, not this machine. Run again with --force if you mean it.`;
}

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
      and (table_name like 'pipeline\\_%' or table_name like 'cloud\\_%')
      -- The access stamp is bookkeeping, not demo data; caches compare against it.
      and table_name <> 'pipeline_access_stamps'`;
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
