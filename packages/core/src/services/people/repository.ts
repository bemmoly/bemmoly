import type { CostCentre, EmploymentState, Location, Person } from '@bemmoly/shared/people';
import type { PeopleFilter } from '../../contracts/people.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

export interface PersonRow {
  user_id: string;
  name: string;
  email: string;
  state: EmploymentState;
  start_date: string | null;
  end_date: string | null;
  job_title: string | null;
  level: string | null;
  manager_id: string | null;
  team_id: string | null;
  location_id: string | null;
  cost_centre_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface LocationRow {
  id: string;
  name: string;
  timezone: string;
  country_code: string | null;
  holiday_calendar: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CostCentreRow {
  id: string;
  code: string;
  name: string;
  owner_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string) => new Date(value).toISOString();

/** `date` columns are read as text (see `PERSON_COLUMNS`), so they stay calendar dates. */
export function toPerson(row: PersonRow): Person {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    state: row.state,
    startDate: row.start_date,
    endDate: row.end_date,
    jobTitle: row.job_title,
    level: row.level,
    managerId: row.manager_id,
    teamId: row.team_id,
    locationId: row.location_id,
    costCentreId: row.cost_centre_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    countryCode: row.country_code,
    holidayCalendar: row.holiday_calendar,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toCostCentre(row: CostCentreRow): CostCentre {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** Walks stop here, so a cycle that slipped in can never loop a query. */
export const MAX_ORG_DEPTH = 64;

const columns = (sql: SqlExecutor) => sql`
  p.user_id, u.name, u.email, p.state, p.start_date::text as start_date,
  p.end_date::text as end_date, p.job_title, p.level, p.manager_id, p.team_id, p.location_id,
  p.cost_centre_id, p.created_at, p.updated_at`;

export async function personRow(sql: SqlExecutor, userId: string): Promise<PersonRow | null> {
  const [row] = await sql<PersonRow[]>`
    select ${columns(sql)} from people p join users u on u.id = p.user_id
    where p.user_id = ${userId}`;
  return row ?? null;
}

/** Locks the row for an update in the caller's transaction. */
export async function personRowForUpdate(
  sql: SqlExecutor,
  userId: string,
): Promise<PersonRow | null> {
  const [row] = await sql<PersonRow[]>`
    select ${columns(sql)} from people p join users u on u.id = p.user_id
    where p.user_id = ${userId} for update of p`;
  return row ?? null;
}

export async function personRows(sql: SqlExecutor, userIds: readonly string[]) {
  if (userIds.length === 0) return [];
  return sql<PersonRow[]>`
    select ${columns(sql)} from people p join users u on u.id = p.user_id
    where p.user_id = any(${userIds as string[]}::uuid[])`;
}

export async function filteredRows(
  sql: SqlExecutor,
  filter: PeopleFilter,
  page?: { after: string | null; limit: number },
): Promise<PersonRow[]> {
  const states = filter.states ? [...filter.states] : null;
  return sql<PersonRow[]>`
    select ${columns(sql)} from people p join users u on u.id = p.user_id
    where true
      ${filter.teamId ? sql`and p.team_id = ${filter.teamId}` : sql``}
      ${filter.locationId ? sql`and p.location_id = ${filter.locationId}` : sql``}
      ${filter.costCentreId ? sql`and p.cost_centre_id = ${filter.costCentreId}` : sql``}
      ${filter.managerId ? sql`and p.manager_id = ${filter.managerId}` : sql``}
      ${states ? sql`and p.state = any(${states}::text[])` : sql``}
      ${page?.after ? sql`and p.user_id > ${page.after}` : sql``}
    ${page ? sql`order by p.user_id limit ${page.limit + 1}` : sql`order by lower(u.name), p.user_id`}`;
}

/** Managers above `userId`, nearest first. */
export async function chainRows(sql: SqlExecutor, userId: string): Promise<PersonRow[]> {
  return sql<PersonRow[]>`
    with recursive chain (user_id, depth) as (
      select manager_id, 1 from people where user_id = ${userId} and manager_id is not null
      union all
      select p.manager_id, c.depth + 1 from chain c join people p on p.user_id = c.user_id
      where p.manager_id is not null and c.depth < ${MAX_ORG_DEPTH}
    )
    select ${columns(sql)} from chain c
    join people p on p.user_id = c.user_id join users u on u.id = p.user_id
    order by c.depth`;
}

/** People below `userId`, nearest first, then by name. */
export async function reportRows(
  sql: SqlExecutor,
  userId: string,
  all: boolean,
): Promise<PersonRow[]> {
  const depth = all ? MAX_ORG_DEPTH : 1;
  return sql<PersonRow[]>`
    with recursive below (user_id, depth) as (
      select user_id, 1 from people where manager_id = ${userId}
      union all
      select p.user_id, b.depth + 1 from below b join people p on p.manager_id = b.user_id
      where b.depth < ${depth}
    )
    select ${columns(sql)} from below b
    join people p on p.user_id = b.user_id join users u on u.id = p.user_id
    order by b.depth, lower(u.name), p.user_id`;
}

export async function locationRow(sql: SqlExecutor, id: string) {
  const [row] = await sql<LocationRow[]>`select * from locations where id = ${id}`;
  return row ?? null;
}

export async function locationRows(sql: SqlExecutor) {
  return sql<LocationRow[]>`select * from locations order by lower(name)`;
}

export async function costCentreRow(sql: SqlExecutor, id: string) {
  const [row] = await sql<CostCentreRow[]>`select * from cost_centres where id = ${id}`;
  return row ?? null;
}

export async function costCentreRows(sql: SqlExecutor) {
  return sql<CostCentreRow[]>`select * from cost_centres order by lower(code)`;
}

export type { CostCentreRow, LocationRow };
