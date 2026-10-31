import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  CostCentre,
  CreateCostCentreInput,
  CreateLocationInput,
  Location,
  UpdateCostCentreInput,
  UpdateLocationInput,
} from '@bemmoly/shared/people';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { manage, type PeopleDeps } from './context.ts';
import {
  costCentreRow,
  costCentreRows,
  locationRow,
  locationRows,
  toCostCentre,
  toLocation,
} from './repository.ts';

const pgCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

/** Turns the constraint errors a write can hit into the errors the API answers with. */
async function constrained<T>(what: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (pgCode(error) === '23505') throw new ConflictError(`A ${what} with that name exists`);
    // 23001 is a RESTRICT foreign key refusing a delete, 23503 a key that points nowhere.
    if (pgCode(error) === '23001' || pgCode(error) === '23503') {
      if (String((error as { message?: string }).message).includes('owner_user_id')) {
        const message = 'The owner was not found';
        throw new ValidationError(message, {
          details: { issues: [{ path: 'ownerUserId', message }] },
        });
      }
      throw new ConflictError(`People are still assigned to this ${what}`);
    }
    throw error;
  }
}

const defined = <T extends object>(input: T) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

/** Locations and cost centres: anyone signed in reads them, People managers write them. */
export function createOrgEntities(deps: PeopleDeps) {
  const { sql } = deps;

  async function audit(
    actor: Actor,
    action: string,
    id: string,
    before?: unknown,
    after?: unknown,
  ) {
    const target = { kind: action.split('.')[0]!, id };
    await deps.audit.record({
      actor,
      action,
      target,
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    });
  }

  async function mustLocation(tx: SqlExecutor, id: string) {
    const row = await locationRow(tx, id);
    if (!row) throw new NotFoundError('The location was not found');
    return row;
  }

  async function mustCostCentre(tx: SqlExecutor, id: string) {
    const row = await costCentreRow(tx, id);
    if (!row) throw new NotFoundError('The cost centre was not found');
    return row;
  }

  return {
    async listLocations(): Promise<Location[]> {
      return (await locationRows(sql)).map(toLocation);
    },
    async getLocation(id: string): Promise<Location> {
      return toLocation(await mustLocation(sql, id));
    },
    async createLocation(actor: Actor, input: CreateLocationInput): Promise<Location> {
      await manage(deps, actor);
      const [row] = await constrained(
        'location',
        () => sql`
        insert into locations (name, timezone, country_code, holiday_calendar)
        values (${input.name}, ${input.timezone}, ${input.countryCode ?? null},
          ${input.holidayCalendar ?? null})
        returning *`,
      );
      const location = toLocation(row as Parameters<typeof toLocation>[0]);
      await audit(actor, 'location.created', location.id, undefined, location);
      return location;
    },
    async updateLocation(actor: Actor, id: string, input: UpdateLocationInput): Promise<Location> {
      await manage(deps, actor);
      const before = toLocation(await mustLocation(sql, id));
      const changes = defined({
        name: input.name,
        timezone: input.timezone,
        country_code: input.countryCode,
        holiday_calendar: input.holidayCalendar,
      });
      if (Object.keys(changes).length > 0)
        await constrained(
          'location',
          () => sql`
          update locations set ${sql(changes)}, updated_at = now() where id = ${id}`,
        );
      const after = toLocation(await mustLocation(sql, id));
      await audit(actor, 'location.updated', id, before, after);
      return after;
    },
    async removeLocation(actor: Actor, id: string): Promise<void> {
      await manage(deps, actor);
      const before = toLocation(await mustLocation(sql, id));
      await constrained('location', () => sql`delete from locations where id = ${id}`);
      await audit(actor, 'location.deleted', id, before);
    },

    async listCostCentres(): Promise<CostCentre[]> {
      return (await costCentreRows(sql)).map(toCostCentre);
    },
    async getCostCentre(id: string): Promise<CostCentre> {
      return toCostCentre(await mustCostCentre(sql, id));
    },
    async createCostCentre(actor: Actor, input: CreateCostCentreInput): Promise<CostCentre> {
      await manage(deps, actor);
      const [row] = await constrained(
        'cost centre',
        () => sql`
        insert into cost_centres (code, name, owner_user_id)
        values (${input.code}, ${input.name}, ${input.ownerUserId ?? null})
        returning *`,
      );
      const centre = toCostCentre(row as Parameters<typeof toCostCentre>[0]);
      await audit(actor, 'cost_centre.created', centre.id, undefined, centre);
      return centre;
    },
    async updateCostCentre(
      actor: Actor,
      id: string,
      input: UpdateCostCentreInput,
    ): Promise<CostCentre> {
      await manage(deps, actor);
      const before = toCostCentre(await mustCostCentre(sql, id));
      const changes = defined({
        code: input.code,
        name: input.name,
        owner_user_id: input.ownerUserId,
      });
      if (Object.keys(changes).length > 0)
        await constrained(
          'cost centre',
          () => sql`
          update cost_centres set ${sql(changes)}, updated_at = now() where id = ${id}`,
        );
      const after = toCostCentre(await mustCostCentre(sql, id));
      await audit(actor, 'cost_centre.updated', id, before, after);
      return after;
    },
    async removeCostCentre(actor: Actor, id: string): Promise<void> {
      await manage(deps, actor);
      const before = toCostCentre(await mustCostCentre(sql, id));
      await constrained('cost centre', () => sql`delete from cost_centres where id = ${id}`);
      await audit(actor, 'cost_centre.deleted', id, before);
    },
  };
}

export type OrgEntities = ReturnType<typeof createOrgEntities>;
