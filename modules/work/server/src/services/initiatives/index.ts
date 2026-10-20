import {
  decodeCursor,
  toPage,
  type AuditRecorder,
  type RequestContext,
  type SqlClient,
  type SqlExecutor,
} from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  createInitiativeBodySchema,
  linkInitiativeEpicBodySchema,
  updateInitiativeBodySchema,
  type CreateInitiativeBody,
  type Initiative,
  type InitiativesPage,
  type LinkInitiativeEpicBody,
  type ListInitiativesQuery,
  type UpdateInitiativeBody,
} from '../../../../shared/index.ts';
import { actorUserId, MODULE_RESOURCE, projectResource, requireDatabase } from '../issues/deps.ts';
import { auditMeta } from '../projects/rows.ts';
import { loadRollupRows, rollUp, rollupOf, visibleProjects } from './rollup.ts';
import {
  assertDatesInOrder,
  INITIATIVE_COLUMNS,
  initiativeById,
  loadEpicRefs,
  storingOwner,
  toInitiative,
  type InitiativeRow,
} from './rows.ts';

/*
 * Initiatives: programs of epics across projects and teams. Anyone with Work can read them;
 * people with "Manage initiatives" create, edit, archive and link epics, and only epics they
 * can open. What an initiative reports of its epics follows the projects the reader can open.
 */

export interface InitiativesServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
}

const MANAGE = 'work.initiative.manage';

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createInitiativesService(deps: InitiativesServiceDeps) {
  /** Rows to responses, with each one's rollup over what this person can open. */
  async function present(
    ctx: RequestContext,
    sql: SqlExecutor,
    rows: readonly InitiativeRow[],
  ): Promise<Initiative[]> {
    const rollupRows = await loadRollupRows(
      sql,
      rows.map((row) => row.id),
    );
    const [visible, canManage] = await Promise.all([
      visibleProjects(
        ctx,
        sql,
        rollupRows.map((row) => row.project_id),
      ),
      ctx.authz.can(ctx.actor, MANAGE, MODULE_RESOURCE),
    ]);
    const rollups = rollUp(rollupRows, (id) => visible.has(id));
    return rows.map((row) => toInitiative(row, rollupOf(rollups, row.id), canManage));
  }

  async function one(ctx: RequestContext, sql: SqlExecutor, row: InitiativeRow) {
    const [initiative] = await present(ctx, sql, [row]);
    if (!initiative) throw new NotFoundError('The initiative was not found');
    return initiative;
  }

  async function audited(
    ctx: RequestContext,
    action: string,
    id: string,
    before: unknown,
    after: unknown,
  ) {
    await deps.audit?.record({
      actor: ctx.actor,
      action,
      target: { kind: 'initiative', id },
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
      meta: auditMeta(ctx),
    });
  }

  /** Epics the person may link: real, live epics in projects they can open. */
  async function epicsToLink(ctx: RequestContext, sql: SqlExecutor, ids: readonly string[]) {
    const unique = [...new Set(ids)];
    const refs = await loadEpicRefs(sql, unique);
    for (const id of unique) {
      const ref = refs.find((entry) => entry.id === id);
      if (!ref) throw new NotFoundError('The epic was not found');
      if (ref.level !== 'epic') {
        throw new ValidationError(`${ref.key} is not an epic; only epics join an initiative`, {
          details: { path: 'epicId' },
        });
      }
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(ref.project_id));
    }
    return refs;
  }

  async function managed(ctx: RequestContext, sql: SqlExecutor, id: string) {
    await ctx.authz.authorize(ctx.actor, MANAGE, MODULE_RESOURCE);
    return initiativeById(sql, id);
  }

  async function setArchived(ctx: RequestContext, id: string, archived: boolean) {
    const sql = requireDatabase(deps);
    const before = await managed(ctx, sql, id);
    const [row] = await sql<InitiativeRow[]>`
      update initiatives set archived_at = ${archived ? sql`now()` : null}, updated_at = now()
      where id = ${id} returning ${sql.unsafe(INITIATIVE_COLUMNS)}`;
    if (!row) throw new NotFoundError('The initiative was not found');
    await audited(ctx, archived ? 'initiative.archived' : 'initiative.unarchived', id, before, row);
    return one(ctx, sql, row);
  }

  return {
    async list(ctx: RequestContext, query: ListInitiativesQuery): Promise<InitiativesPage> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const sql = requireDatabase(deps);
      const cursorId = decodeCursor(query.cursor);
      const prefix = query.q
        ? sql`and lower(name) like ${`${escapeLike(query.q.toLowerCase())}%`}`
        : sql``;
      const after = cursorId
        ? sql`and (lower(name), id) > (
            (select lower(name) from initiatives where id = ${cursorId}), ${cursorId}::uuid)`
        : sql``;
      const rows = await sql<InitiativeRow[]>`
        select ${sql.unsafe(INITIATIVE_COLUMNS)} from initiatives
        where (archived_at is not null) = ${query.archived} ${prefix} ${after}
        order by lower(name), id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: await present(ctx, sql, page.rows), nextCursor: page.nextCursor };
    },

    async get(ctx: RequestContext, id: string): Promise<Initiative> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const sql = requireDatabase(deps);
      return one(ctx, sql, await initiativeById(sql, id));
    },

    async create(ctx: RequestContext, input: CreateInitiativeBody): Promise<Initiative> {
      const body = createInitiativeBodySchema.parse(input);
      await ctx.authz.authorize(ctx.actor, MANAGE, MODULE_RESOURCE);
      const sql = requireDatabase(deps);
      await epicsToLink(ctx, sql, body.epicIds ?? []);
      const by = actorUserId(ctx);
      const row = await storingOwner(() =>
        sql.begin(async (tx) => {
          const [created] = await tx<InitiativeRow[]>`
            insert into initiatives (name, description, owner_id, start_at, target_at, created_by)
            values (${body.name}, ${body.description ?? null}, ${body.ownerId ?? null},
              ${body.startAt ?? null}, ${body.targetAt ?? null}, ${by})
            returning ${tx.unsafe(INITIATIVE_COLUMNS)}`;
          if (!created) throw new NotFoundError('The initiative was not stored');
          for (const epicId of new Set(body.epicIds ?? [])) {
            await tx`
              insert into initiative_epics (initiative_id, epic_id, added_by)
              values (${created.id}, ${epicId}, ${by})`;
          }
          return created;
        }),
      );
      await audited(ctx, 'initiative.created', row.id, undefined, {
        ...row,
        epicIds: body.epicIds ?? [],
      });
      return one(ctx, sql, row);
    },

    async update(ctx: RequestContext, id: string, input: UpdateInitiativeBody) {
      const patch = updateInitiativeBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const before = await managed(ctx, sql, id);
      assertDatesInOrder(
        patch.startAt === undefined ? before.start_at : patch.startAt,
        patch.targetAt === undefined ? before.target_at : patch.targetAt,
      );
      const set = (field: keyof typeof patch) => patch[field] !== undefined;
      const [row] = await storingOwner(
        () => sql<InitiativeRow[]>`
          update initiatives set
            name = coalesce(${patch.name ?? null}, name),
            description = case when ${set('description')} then ${patch.description ?? null}
              else description end,
            owner_id = case when ${set('ownerId')} then ${patch.ownerId ?? null}::uuid
              else owner_id end,
            start_at = case when ${set('startAt')} then ${patch.startAt ?? null}::date
              else start_at end,
            target_at = case when ${set('targetAt')} then ${patch.targetAt ?? null}::date
              else target_at end,
            updated_at = now()
          where id = ${id} returning ${sql.unsafe(INITIATIVE_COLUMNS)}`,
      );
      if (!row) throw new NotFoundError('The initiative was not found');
      await audited(ctx, 'initiative.updated', id, before, row);
      return one(ctx, sql, row);
    },

    archive: (ctx: RequestContext, id: string) => setArchived(ctx, id, true),
    unarchive: (ctx: RequestContext, id: string) => setArchived(ctx, id, false),

    async linkEpic(ctx: RequestContext, id: string, input: LinkInitiativeEpicBody) {
      const body = linkInitiativeEpicBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const initiative = await managed(ctx, sql, id);
      if (initiative.archived_at) {
        throw new ConflictError('Unarchive the initiative before changing its epics');
      }
      const [epic] = await epicsToLink(ctx, sql, [body.epicId]);
      const added = await sql<{ epic_id: string }[]>`
        insert into initiative_epics (initiative_id, epic_id, added_by)
        values (${id}, ${body.epicId}, ${actorUserId(ctx)})
        on conflict do nothing returning epic_id`;
      if (added.length === 0) {
        throw new ConflictError(`${epic?.key ?? 'The epic'} is already in ${initiative.name}`);
      }
      await audited(ctx, 'initiative.epic_linked', id, undefined, { epicId: body.epicId });
      return one(ctx, sql, initiative);
    },

    async unlinkEpic(ctx: RequestContext, id: string, epicId: string): Promise<void> {
      const sql = requireDatabase(deps);
      const initiative = await managed(ctx, sql, id);
      if (initiative.archived_at) {
        throw new ConflictError('Unarchive the initiative before changing its epics');
      }
      const removed = await sql<{ epic_id: string }[]>`
        delete from initiative_epics where initiative_id = ${id} and epic_id = ${epicId}
        returning epic_id`;
      if (removed.length === 0) throw new NotFoundError('The epic is not in this initiative');
      await audited(ctx, 'initiative.epic_unlinked', id, { epicId }, undefined);
    },
  };
}

export type InitiativesService = ReturnType<typeof createInitiativesService>;
