import {
  decodeCursor,
  toPage,
  type AuditRecorder,
  type ContainerMemberships,
  type RealtimePublisher,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { ConflictError, ProviderError } from '@bemmoly/shared';
import type {
  CreateProjectBody,
  ListProjectsQuery,
  Project,
  ProjectsPage,
  UpdateProjectBody,
} from '../../../../shared/projects.ts';
import { joinAsCreator, visibleProjectIds } from './membership-defaults.ts';
import {
  auditMeta,
  PROJECT_COLUMNS,
  projectByKey,
  projectResource,
  toProject,
  WORK_MODULE,
  type ProjectRow,
} from './rows.ts';

export interface ProjectsServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
  memberships?: ContainerMemberships;
}

const UNIQUE_VIOLATION = '23505';

export const PROJECT_CHANGED = 'work.project.changed';

/** Projects as the Work screens list, create and configure them. */
export function createProjectsService(deps: ProjectsServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  const changed = (id: string) =>
    deps.realtime?.publish({ kind: PROJECT_CHANGED, ids: [id], projectId: id });

  async function update(ctx: RequestContext, key: string, patch: UpdateProjectBody) {
    const sql = db();
    const project = await projectByKey(sql, key);
    await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
    const [row] = await sql<ProjectRow[]>`
      update projects set
        name = coalesce(${patch.name ?? null}, name),
        description = case when ${patch.description !== undefined} then ${patch.description ?? null} else description end,
        team_id = case when ${patch.teamId !== undefined} then ${patch.teamId ?? null}::uuid else team_id end,
        method = coalesce(${patch.method ?? null}, method),
        default_space_id = case when ${patch.defaultSpaceId !== undefined} then ${patch.defaultSpaceId ?? null}::uuid else default_space_id end,
        updated_at = now()
      where id = ${project.id}
      returning ${sql.unsafe(PROJECT_COLUMNS)}`;
    if (!row) throw new ProviderError('The project was not updated');
    await audited(ctx, 'project.updated', project, row);
    return toProject(row);
  }

  /** Every change to a project's row is one audit entry with the row before and after. */
  async function audited(
    ctx: RequestContext,
    action: string,
    before: ProjectRow,
    after: ProjectRow,
  ) {
    await deps.audit?.record({
      actor: ctx.actor,
      action,
      target: { kind: 'project', id: after.id },
      before: toProject(before),
      after: toProject(after),
      meta: auditMeta(ctx),
    });
    await changed(after.id);
  }

  async function setArchived(ctx: RequestContext, key: string, archived: boolean) {
    const sql = db();
    const project = await projectByKey(sql, key);
    await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
    const [row] = await sql<ProjectRow[]>`
      update projects set archived_at = ${archived ? sql`now()` : null}, updated_at = now()
      where id = ${project.id}
      returning ${sql.unsafe(PROJECT_COLUMNS)}`;
    if (!row) throw new ProviderError('The project was not updated');
    await audited(ctx, archived ? 'project.archived' : 'project.unarchived', project, row);
    return toProject(row);
  }

  return {
    async list(ctx: RequestContext, query: ListProjectsQuery): Promise<ProjectsPage> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', WORK_MODULE);
      const sql = db();
      const cursor = decodeCursor(query.cursor);
      const visible = await visibleProjectIds(sql, ctx);
      const rows = await sql<ProjectRow[]>`
        select ${sql.unsafe(PROJECT_COLUMNS)}
        from projects
        where (${query.archived} or archived_at is null)
          and (${query.teamId ?? null}::uuid is null or team_id = ${query.teamId ?? null})
          and (${visible === null} or id = any(${visible ?? []}::uuid[]))
          ${cursor ? sql`and id > ${cursor}` : sql``}
        order by id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toProject), nextCursor: page.nextCursor };
    },

    async get(ctx: RequestContext, key: string): Promise<Project> {
      const project = await projectByKey(db(), key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      return toProject(project);
    },

    /**
     * A new project inherits every org default by having no override, so
     * only the project, its issue counter and its first members are written,
     * in one transaction with the audit row.
     */
    async create(ctx: RequestContext, body: CreateProjectBody): Promise<Project> {
      await ctx.authz.authorize(ctx.actor, 'work.project.create', WORK_MODULE);
      const sql = db();
      const key = body.key.trim().toUpperCase();
      try {
        const row = await sql.begin(async (tx) => {
          const [created] = await tx<ProjectRow[]>`
            insert into projects (key, name, description, team_id, method)
            values (${key}, ${body.name}, ${body.description ?? null},
              ${body.teamId ?? null}::uuid, ${body.method ?? 'scrum'})
            returning ${tx.unsafe(PROJECT_COLUMNS)}`;
          if (!created) throw new ProviderError('The project was not stored');
          await tx`insert into project_counters (project_id) values (${created.id})`;
          await joinAsCreator(deps.memberships, ctx, tx, created);
          await deps.audit?.record(
            {
              actor: ctx.actor,
              action: 'project.created',
              target: { kind: 'project', id: created.id },
              after: toProject(created),
              meta: auditMeta(ctx),
            },
            tx,
          );
          return created;
        });
        await changed(row.id);
        return toProject(row);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictError(`A project with the key ${key} already exists`);
        }
        throw error;
      }
    },

    update,
    archive: (ctx: RequestContext, key: string) => setArchived(ctx, key, true),
    unarchive: (ctx: RequestContext, key: string) => setArchived(ctx, key, false),

    /** Only an archived project can go, so a slip in the UI is two steps away from data loss. */
    async remove(ctx: RequestContext, key: string): Promise<void> {
      const sql = db();
      const project = await projectByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
      if (!project.archived_at) throw new ConflictError('Archive the project before deleting it');
      await sql`delete from projects where id = ${project.id}`;
      await deps.audit?.record({
        actor: ctx.actor,
        action: 'project.deleted',
        target: { kind: 'project', id: project.id },
        before: toProject(project),
        meta: auditMeta(ctx),
      });
      await changed(project.id);
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
