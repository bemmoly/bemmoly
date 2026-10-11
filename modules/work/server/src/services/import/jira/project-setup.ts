import type { ContainerMemberships, ImportRunContext, SqlClient } from '@bemmoly/core';
import { PROJECT_ADMIN_ROLE_KEY } from '../../../../../shared/members.ts';
import type { JiraClient, JiraProject, JiraStatus } from '../../../clients/jira.ts';
import { copyWorkflowToProject } from '../../workflow/project-copy.ts';
import { categoryOf, matchIssueType, projectKeyFrom, workStatuses, workTypes } from './schema.ts';

/*
 * Everything a project's issues point at, made or found before the first issue is written:
 * the project (matched by key when it exists), its issue types and statuses mapped (statuses
 * Work's workflow lacks are added to the project's own copy), versions and components. It
 * runs again on every resume and re-run; the mappings make each step find what it made.
 */

export interface ProjectSetup {
  jira: JiraProject;
  projectId: string;
  key: string;
  statuses: Map<string, { id: string; category: 'todo' | 'in_progress' | 'done' }>;
  types: Map<string, string>;
  versions: Map<string, string>;
  components: Map<string, string>;
}

export interface SetupDeps {
  sql: SqlClient;
  memberships?: ContainerMemberships;
}

async function ensureProject(deps: SetupDeps, jira: JiraProject, ctx: ImportRunContext) {
  const { sql } = deps;
  const mapped = await ctx.mappings.get('project', jira.id);
  if (mapped) {
    const [row] = await sql<{ id: string; key: string }[]>`
      select id, key from projects where id = ${mapped.targetId}`;
    if (row) return row;
  }
  const key = projectKeyFrom(jira.key);
  if (key !== jira.key)
    ctx.report.warn(`Project ${jira.key} is ${key} here; its issue keys follow.`);
  const method =
    jira.style === 'next-gen' || jira.projectTypeKey === 'business' ? 'kanban' : 'scrum';
  const row = await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string; key: string }[]>`
      insert into projects (key, name, description, method)
      values (${key}, ${jira.name.slice(0, 120)}, ${jira.description?.slice(0, 5000) || null}, ${method})
      on conflict (key) do update set updated_at = projects.updated_at
      returning id, key, (xmax = 0) as inserted`;
    if (!created) throw new Error(`Project ${key} was not stored`);
    await tx`insert into project_counters (project_id) values (${created.id}) on conflict do nothing`;
    if (deps.memberships && ctx.actorUserId) {
      const roles = await deps.memberships.roles(tx);
      const admin = roles.find((role) => role.key === PROJECT_ADMIN_ROLE_KEY);
      await deps.memberships.add(
        'project',
        created.id,
        { userIds: [ctx.actorUserId], ...(admin ? { roleId: admin.id } : {}) },
        tx,
      );
    }
    return created as { id: string; key: string; inserted?: boolean };
  });
  ctx.report.count('projects', row.inserted ? 'created' : 'updated');
  await ctx.mappings.set('project', jira.id, row.id, { key: jira.key });
  return { id: row.id, key: row.key };
}

export async function ensureStatuses(
  sql: SqlClient,
  project: { id: string; key: string },
  jiraStatuses: readonly JiraStatus[],
  ctx: ImportRunContext,
): Promise<ProjectSetup['statuses']> {
  let current = await workStatuses(sql, project.id);
  const byName = () => new Map(current.map((status) => [status.name.toLowerCase(), status]));
  const missing = jiraStatuses.filter((status) => !byName().has(status.name.toLowerCase()));
  if (missing.length) {
    await sql.begin(async (tx) => {
      const [own] = await tx<{ id: string }[]>`
        select id from workflows where project_id = ${project.id} order by id limit 1`;
      const workflowId = own?.id ?? (await copyWorkflowToProject(tx, project)).id;
      if (!own) {
        await tx`
          update projects set scheme_overrides = scheme_overrides || jsonb_build_object('workflow',
            jsonb_build_object('overriddenAt', now(), 'overriddenBy', ${ctx.actorUserId}::text)),
            updated_at = now()
          where id = ${project.id}`;
      }
      const [{ position } = { position: 0 }] = await tx<{ position: number }[]>`
        select coalesce(max(position), 0) as position from workflow_statuses where workflow_id = ${workflowId}`;
      for (const [index, status] of missing.entries()) {
        const [row] = await tx<{ id: string }[]>`
          insert into workflow_statuses (workflow_id, name, category, position)
          values (${workflowId}, ${status.name.slice(0, 60)}, ${categoryOf(status)}, ${position + index + 1})
          on conflict (workflow_id, lower(name)) do nothing
          returning id`;
        if (!row) continue;
        await tx`
          insert into workflow_transitions (workflow_id, from_status_id, to_status_id, name, position)
          values (${workflowId}, null, ${row.id}, ${status.name.slice(0, 60)}, ${position + index + 1})`;
        ctx.report.count('statuses', 'created');
      }
    });
    current = await workStatuses(sql, project.id);
  }
  const names = byName();
  const map: ProjectSetup['statuses'] = new Map();
  for (const status of jiraStatuses) {
    const found = names.get(status.name.toLowerCase());
    if (found) map.set(status.id, { id: found.id, category: found.category });
  }
  return map;
}

/** Versions and components by name; what a re-run finds by mapping is renamed to match. */
async function ensureNamed(
  sql: SqlClient,
  table: 'versions' | 'components',
  projectId: string,
  items: readonly {
    id: string;
    name: string;
    description?: string;
    released?: boolean;
    archived?: boolean;
    releaseDate?: string;
  }[],
  ctx: ImportRunContext,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const kind = table === 'versions' ? 'version' : 'component';
  for (const item of items) {
    const name = item.name.trim().slice(0, 60);
    if (!name) continue;
    const status = item.archived ? 'archived' : item.released ? 'released' : 'unreleased';
    const [row] =
      table === 'versions'
        ? await sql<{ id: string }[]>`
            insert into versions (project_id, name, description, status, release_at)
            values (${projectId}, ${name}, ${item.description ?? null}, ${status}, ${item.releaseDate ?? null}::date)
            on conflict (project_id, lower(name)) do update
              set status = excluded.status, release_at = excluded.release_at, updated_at = now()
            returning id`
        : await sql<{ id: string }[]>`
            insert into components (project_id, name, description)
            values (${projectId}, ${name}, ${item.description ?? null})
            on conflict (project_id, lower(name)) do update set updated_at = now()
            returning id`;
    if (!row) continue;
    map.set(item.id, row.id);
    await ctx.mappings.set(kind, item.id, row.id);
  }
  ctx.report.count(table, 'updated', map.size);
  return map;
}

export async function setupProject(
  deps: SetupDeps,
  client: JiraClient,
  summary: JiraProject,
  ctx: ImportRunContext,
): Promise<ProjectSetup> {
  const jira = await client.project(summary.key);
  const project = await ensureProject(deps, jira, ctx);
  const byType = await client.statuses(jira.key);
  const unique = new Map(
    byType.flatMap((group) => group.statuses).map((status) => [status.id, status]),
  );
  const statuses = await ensureStatuses(deps.sql, project, [...unique.values()], ctx);
  const workTypeRows = await workTypes(deps.sql, project.id);
  const types = new Map<string, string>();
  for (const type of jira.issueTypes ?? []) {
    const match = matchIssueType(type, workTypeRows);
    if (match) types.set(type.id, match.row.id);
  }
  const versions = await ensureNamed(
    deps.sql,
    'versions',
    project.id,
    await client.versions(jira.key),
    ctx,
  );
  const components = await ensureNamed(
    deps.sql,
    'components',
    project.id,
    await client.components(jira.key),
    ctx,
  );
  return { jira, projectId: project.id, key: project.key, statuses, types, versions, components };
}
