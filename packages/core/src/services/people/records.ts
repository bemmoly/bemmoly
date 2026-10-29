import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  canTransition,
  type CreatePersonInput,
  type ListPeopleQuery,
  type PeoplePage,
  type Person,
  type UpdatePersonInput,
} from '@bemmoly/shared/people';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { decodeCursor, encodeCursor } from '../../utils/keyset.ts';
import { manage, nowOf, type PeopleDeps } from './context.ts';
import { eventsFor } from './events.ts';
import {
  chainRows,
  filteredRows,
  personRow,
  personRowForUpdate,
  toPerson,
  type PersonRow,
} from './repository.ts';

type Fields = Omit<Person, 'name' | 'email' | 'createdAt' | 'updatedAt'>;

const invalid = (path: string, message: string) =>
  new ValidationError(message, { details: { issues: [{ path, message }] } });

const fieldsOf = (row: PersonRow): Fields => ({
  userId: row.user_id,
  state: row.state,
  startDate: row.start_date,
  endDate: row.end_date,
  jobTitle: row.job_title,
  level: row.level,
  managerId: row.manager_id,
  teamId: row.team_id,
  locationId: row.location_id,
  costCentreId: row.cost_centre_id,
});

/** Applies the fields present in `input`; `undefined` keeps, `null` clears. */
function merge(current: Fields, input: UpdatePersonInput): Fields {
  const next = { ...current };
  for (const [key, value] of Object.entries(input) as [keyof UpdatePersonInput, unknown][]) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

async function exists(tx: SqlExecutor, table: 'teams' | 'locations' | 'cost_centres', id: string) {
  const rows = await tx`select 1 from ${tx(table)} where id = ${id}`;
  return rows.length > 0;
}

async function checkReferences(tx: SqlExecutor, fields: Fields): Promise<void> {
  if (fields.teamId && !(await exists(tx, 'teams', fields.teamId)))
    throw invalid('teamId', 'The team was not found');
  if (fields.locationId && !(await exists(tx, 'locations', fields.locationId)))
    throw invalid('locationId', 'The location was not found');
  if (fields.costCentreId && !(await exists(tx, 'cost_centres', fields.costCentreId)))
    throw invalid('costCentreId', 'The cost centre was not found');
  if (fields.startDate && fields.endDate && fields.startDate > fields.endDate)
    throw invalid('endDate', 'The end date is before the start date');
  const managerId = fields.managerId;
  if (!managerId) return;
  if (managerId === fields.userId) throw invalid('managerId', 'Someone cannot manage themselves');
  // Two concurrent manager changes could each pass the check below and close a loop together.
  await tx`select pg_advisory_xact_lock(hashtext('people.reporting_lines'))`;
  if (!(await personRow(tx, managerId)))
    throw invalid('managerId', 'The manager has no person record');
  const above = await chainRows(tx, managerId);
  if (above.some((row) => row.user_id === fields.userId))
    throw invalid('managerId', 'That manager reports to this person');
}

async function write(tx: SqlExecutor, fields: Fields, insert: boolean): Promise<PersonRow> {
  const columns = {
    state: fields.state,
    start_date: fields.startDate,
    end_date: fields.endDate,
    job_title: fields.jobTitle,
    level: fields.level,
    manager_id: fields.managerId,
    team_id: fields.teamId,
    location_id: fields.locationId,
    cost_centre_id: fields.costCentreId,
  };
  if (insert) await tx`insert into people ${tx({ user_id: fields.userId, ...columns })}`;
  else
    await tx`
      update people set ${tx(columns)}, updated_at = now() where user_id = ${fields.userId}`;
  return (await personRow(tx, fields.userId))!;
}

const audited = (fields: Fields) => ({ ...fields });

/** Writes and the people list; reads of one record go through the directory. */
export function createPeopleRecords(deps: PeopleDeps) {
  async function commit(actor: Actor, before: PersonRow | null, fields: Fields, tx: SqlExecutor) {
    await checkReferences(tx, fields);
    const row = await write(tx, fields, before === null);
    const after = toPerson(row);
    await deps.audit.record(
      {
        actor,
        action: before ? 'person.updated' : 'person.created',
        target: { kind: 'person', id: fields.userId },
        ...(before ? { before: audited(fieldsOf(before)) } : {}),
        after: audited(fieldsOf(row)),
      },
      tx,
    );
    const events = eventsFor(before ? toPerson(before) : null, after, actor, nowOf(deps));
    for (const event of events) await deps.events.publish({ ...event, transaction: tx });
    return after;
  }

  return {
    async create(actor: Actor, input: CreatePersonInput): Promise<Person> {
      await manage(deps, actor);
      return deps.sql.begin(async (tx) => {
        const users = await tx`select 1 from users where id = ${input.userId}`;
        if (users.length === 0) throw new NotFoundError('The user was not found');
        if (await personRow(tx, input.userId))
          throw new ConflictError('This person already has a record');
        const { userId, ...rest } = input;
        const fields = merge(
          {
            userId,
            state: 'offer_accepted',
            startDate: null,
            endDate: null,
            jobTitle: null,
            level: null,
            managerId: null,
            teamId: null,
            locationId: null,
            costCentreId: null,
          },
          rest,
        );
        return commit(actor, null, fields, tx);
      }) as Promise<Person>;
    },

    async update(actor: Actor, userId: string, input: UpdatePersonInput): Promise<Person> {
      await manage(deps, actor);
      return deps.sql.begin(async (tx) => {
        const before = await personRowForUpdate(tx, userId);
        if (!before) throw new NotFoundError('The person was not found');
        const fields = merge(fieldsOf(before), input);
        if (!canTransition(before.state, fields.state))
          throw invalid('state', `A person cannot go from ${before.state} to ${fields.state}`);
        return commit(actor, before, fields, tx);
      }) as Promise<Person>;
    },

    /** Keyset on the user id; the directory's `list` is the unpaged, name-ordered read. */
    async list(query: ListPeopleQuery): Promise<PeoplePage> {
      const rows = await filteredRows(
        deps.sql,
        {
          ...(query.teamId ? { teamId: query.teamId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
          ...(query.costCentreId ? { costCentreId: query.costCentreId } : {}),
          ...(query.managerId ? { managerId: query.managerId } : {}),
          ...(query.state ? { states: [query.state] } : {}),
        },
        { after: decodeCursor(query.cursor), limit: query.limit },
      );
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        items: page.map(toPerson),
        nextCursor: rows.length > query.limit && last ? encodeCursor(last.user_id) : null,
      };
    },
  };
}

export type PeopleRecords = ReturnType<typeof createPeopleRecords>;
