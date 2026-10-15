import {
  ValidationError,
  type ImportPeoplePage,
  type ImportPeopleQuery,
  type ImportPersonOverride,
  type ImportPlanPeople,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { ImportPerson } from '../../contracts/importer.ts';

/*
 * The people pass a plan makes: everyone the chosen containers name, matched by email to an
 * active member, else a placeholder (an address the source gave, no member yet) or hidden (no
 * address at all). An admin's choice for a person (this member, or keep a placeholder) stays
 * across re-plans and is what the run uses.
 */

const CHUNK = 1000;

export async function storePeople(
  tx: SqlExecutor,
  jobId: string,
  people: readonly ImportPerson[],
): Promise<void> {
  const unique = new Map(people.map((person) => [person.sourceId, person]));
  const rows = [...unique.values()].map((person) => ({
    source_id: person.sourceId.slice(0, 400),
    name: (person.name || person.email || person.sourceId).slice(0, 200),
    email: person.email?.trim().toLowerCase() || null,
  }));
  await tx`
    delete from import_people
    where job_id = ${jobId} and not (source_id = any(${rows.map((row) => row.source_id)}::text[]))`;
  for (let start = 0; start < rows.length; start += CHUNK) {
    await tx`
      insert into import_people (job_id, source_id, name, email, match)
      select ${jobId}::uuid, r.source_id, r.name, r.email,
        case when r.email is null then 'hidden' else 'placeholder' end
      from jsonb_to_recordset(${JSON.stringify(rows.slice(start, start + CHUNK))}::jsonb)
        as r(source_id text, name text, email text)
      on conflict (job_id, source_id) do update
        set name = excluded.name, email = excluded.email, updated_at = now()`;
  }
  await rematch(tx, jobId);
}

/** Matches by email everyone the admin has not set by hand. */
async function rematch(tx: SqlExecutor, jobId: string): Promise<void> {
  await tx`
    update import_people p set
      user_id = u.id,
      match = case when p.email is null then 'hidden'
        when u.id is not null then 'matched' else 'placeholder' end,
      updated_at = now()
    from import_people q
    left join users u on lower(u.email) = q.email and u.status = 'active'
    where p.id = q.id and p.job_id = ${jobId} and p.override is null`;
}

/** Applies the admin's choices; unknown people are refused by the caller's check. */
export async function overridePeople(
  tx: SqlExecutor,
  jobId: string,
  overrides: Readonly<Record<string, ImportPersonOverride>>,
): Promise<string[]> {
  const unknown: string[] = [];
  for (const [sourceId, choice] of Object.entries(overrides)) {
    const rows =
      choice === 'placeholder'
        ? await tx`
            update import_people set override = 'placeholder', user_id = null,
              match = case when email is null then 'hidden' else 'placeholder' end,
              updated_at = now()
            where job_id = ${jobId} and source_id = ${sourceId} returning id`
        : await tx`
            update import_people set override = 'user', user_id = u.id, match = 'matched',
              updated_at = now()
            from users u
            where job_id = ${jobId} and source_id = ${sourceId} and u.id = ${choice}
              and u.status = 'active'
            returning import_people.id`;
    if (!rows.length) unknown.push(sourceId);
  }
  return unknown;
}

export async function peopleSummary(sql: SqlExecutor, jobId: string): Promise<ImportPlanPeople> {
  const [row] = await sql<ImportPlanPeople[]>`
    select count(*)::int as total,
      count(*) filter (where match = 'matched')::int as matched,
      count(*) filter (where match = 'placeholder')::int as placeholders,
      count(*) filter (where match = 'hidden')::int as hidden
    from import_people where job_id = ${jobId}`;
  return row ?? { total: 0, matched: 0, placeholders: 0, hidden: 0 };
}

/** A people cursor: the last row's rank, lower-cased name and id; refused if malformed. */
function decodeCursor(cursor: string): [number, string, string] {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(value) &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'string' &&
      typeof value[2] === 'string' &&
      /^[0-9a-f-]{36}$/.test(value[2])
    ) {
      return [value[0], value[1], value[2]];
    }
  } catch {
    // Falls through to the refusal below.
  }
  throw new ValidationError('The cursor is not one this list gave out');
}

/** Placeholders and hidden first (what may need a hand), then by name. */
export async function listPeople(
  sql: SqlExecutor,
  jobId: string,
  query: ImportPeopleQuery,
): Promise<ImportPeoplePage> {
  const position = query.cursor ? decodeCursor(query.cursor) : null;
  const after = position
    ? sql`and (p.rank, lower(p.name), p.id) > (${position[0]}, ${position[1]}, ${position[2]}::uuid)`
    : sql``;
  const rows = await sql<
    {
      id: string;
      rank: number;
      source_id: string;
      name: string;
      email: string | null;
      match: 'matched' | 'placeholder' | 'hidden';
      user_id: string | null;
      user_name: string | null;
      override: string | null;
    }[]
  >`
    select * from (
      select ip.id, case ip.match when 'hidden' then 0 when 'placeholder' then 1 else 2 end as rank,
        ip.source_id, ip.name, ip.email, ip.match, ip.user_id, u.name as user_name, ip.override
      from import_people ip left join users u on u.id = ip.user_id
      where ip.job_id = ${jobId}
    ) p
    where true ${after}
    order by p.rank, lower(p.name), p.id
    limit ${query.limit + 1}`;
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items: items.map((row) => ({
      sourceId: row.source_id,
      name: row.name,
      email: row.email,
      match: row.match,
      userId: row.user_id,
      userName: row.user_name,
      override: row.override !== null,
    })),
    next:
      rows.length > query.limit && last
        ? Buffer.from(JSON.stringify([last.rank, last.name.toLowerCase(), last.id])).toString(
            'base64url',
          )
        : null,
  };
}

/** The admin's choices, for the run's people matcher. */
export async function peopleOverrides(
  sql: SqlExecutor,
  jobId: string,
): Promise<Map<string, string | 'placeholder'>> {
  const rows = await sql<{ source_id: string; override: string; user_id: string | null }[]>`
    select source_id, override, user_id from import_people
    where job_id = ${jobId} and override is not null`;
  return new Map(
    rows.map((row) => [
      row.source_id,
      row.override === 'user' && row.user_id ? row.user_id : 'placeholder',
    ]),
  );
}
