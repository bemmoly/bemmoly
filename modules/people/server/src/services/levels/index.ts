import type { RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { CreateLevelBody, Level, UpdateLevelBody } from '../../../../shared/levels.ts';
import {
  authorize,
  pgCode,
  publishChange,
  recordAudit,
  requireDatabase,
  UNIQUE_VIOLATION,
  SETTINGS_CAPABILITY,
  type PeopleServiceDeps,
} from '../common.ts';

interface LevelRow {
  id: string;
  name: string;
  description: string | null;
  position: number;
}

const toLevel = (row: LevelRow): Level => ({
  id: row.id,
  name: row.name,
  description: row.description,
  position: row.position,
});

async function unique<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION)
      throw new ConflictError('A level with that name exists');
    throw error;
  }
}

/** The career ladder: anyone reads it, People's admins change it. */
export function createLevelsService(deps: PeopleServiceDeps) {
  return {
    async list(): Promise<Level[]> {
      const sql = requireDatabase(deps);
      const rows = await sql<LevelRow[]>`
        select id, name, description, position from people_levels order by position, name`;
      return rows.map(toLevel);
    },

    async create(ctx: RequestContext, body: CreateLevelBody): Promise<Level> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return unique(() =>
        sql.begin(async (tx) => {
          const [row] = await tx<LevelRow[]>`
            insert into people_levels (name, description, position)
            values (${body.name}, ${body.description ?? null},
              coalesce(${body.position ?? null}::int,
                (select coalesce(max(position) + 1, 0) from people_levels)))
            returning id, name, description, position`;
          const level = toLevel(row!);
          await recordAudit(
            deps,
            ctx,
            { action: 'people.level.created', kind: 'people_level', id: level.id, after: level },
            tx,
          );
          await publishChange(deps, 'people.settings', [level.id]);
          return level;
        }),
      );
    },

    async update(ctx: RequestContext, id: string, body: UpdateLevelBody): Promise<Level> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return unique(() =>
        sql.begin(async (tx) => {
          const [before] = await tx<LevelRow[]>`
            select id, name, description, position from people_levels where id = ${id} for update`;
          if (!before) throw new NotFoundError('That level does not exist');
          const [row] = await tx<LevelRow[]>`
            update people_levels set
              name = ${body.name ?? before.name},
              description = ${body.description === undefined ? before.description : body.description},
              position = ${body.position ?? before.position},
              updated_at = now()
            where id = ${id}
            returning id, name, description, position`;
          const level = toLevel(row!);
          await recordAudit(
            deps,
            ctx,
            {
              action: 'people.level.updated',
              kind: 'people_level',
              id,
              before: toLevel(before),
              after: level,
            },
            tx,
          );
          await publishChange(deps, 'people.settings', [id]);
          return level;
        }),
      );
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      await sql.begin(async (tx) => {
        const [row] = await tx<LevelRow[]>`
          delete from people_levels where id = ${id}
          returning id, name, description, position`;
        if (!row) throw new NotFoundError('That level does not exist');
        await recordAudit(
          deps,
          ctx,
          { action: 'people.level.deleted', kind: 'people_level', id, before: toLevel(row) },
          tx,
        );
      });
      await publishChange(deps, 'people.settings', [id]);
    },
  };
}

export type LevelsService = ReturnType<typeof createLevelsService>;
