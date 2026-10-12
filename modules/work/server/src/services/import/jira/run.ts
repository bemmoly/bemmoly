import type {
  ContainerMemberships,
  ImportContainerScope,
  ImportConnection,
  ImportRunContext,
  SqlClient,
} from '@bemmoly/core';
import type { ImportPlan } from '@bemmoly/shared';
import type { JiraClient, JiraIssue, JiraProject } from '../../../clients/jira.ts';
import { writeIssues, writeLabels } from '../writer.ts';
import { importAgile } from './agile.ts';
import { explainJiraError, jiraClientFor, parseJiraConnection } from './connection.ts';
import { projectJql } from './discover.ts';
import { writeAttachments, writeComments } from './extras.ts';
import { createFieldMapper } from './fields.ts';
import { toIssueRow, type LocalKey, type RowContext } from './issue-rows.ts';
import { writeHistory } from './history.ts';
import { writeLinks } from './links.ts';
import { setupProject } from './project-setup.ts';
import { projectKeyFrom } from './schema.ts';

/*
 * A Jira run, project by project, each on its own (a project that fails is recorded and the
 * run moves on): configuration, boards and sprints, then issues a page at a time (each page
 * with its labels, comments and attachments), and finally links across everything imported.
 * Each project's checkpoint is the page cursor it reached, so Retry or Resume starts at the
 * first page not yet written; pages are idempotent anyway.
 */

export interface JiraCheckpoint {
  cursor: string | null;
}

export interface JiraRunDeps {
  sql: SqlClient;
  memberships?: ContainerMemberships;
}

async function importIssues(
  deps: JiraRunDeps,
  client: JiraClient,
  rows: RowContext,
  scope: ImportContainerScope,
): Promise<void> {
  const { ctx, setup } = rows;
  const jql = projectJql(setup.jira.key);
  await scope.progress.phase('Issues', await client.countIssues(jql));
  let cursor = scope.checkpoint.read<JiraCheckpoint>()?.cursor ?? null;
  for (;;) {
    ctx.signal.throwIfAborted();
    const page = await client.searchIssues(jql, cursor, { changelog: ctx.include.history });
    const converted = [];
    for (const issue of page.issues) {
      const row = await toIssueRow(rows, issue);
      if (row) converted.push({ row, issue });
    }
    const written = await writeIssues(
      deps.sql,
      setup.projectId,
      converted.map((item) => item.row),
      ctx.mappings,
      ctx.report,
      { adopt: true },
    );
    const bySource = new Map(written.map((item) => [item.sourceId, item.id]));
    const pageIssues = new Map<string, { issue: JiraIssue; id: string }>();
    const labels = new Map<string, readonly string[]>();
    for (const { issue } of converted) {
      const id = bySource.get(issue.id);
      if (!id) continue;
      pageIssues.set(issue.id, { issue, id });
      labels.set(id, issue.fields.labels ?? []);
    }
    await writeLabels(deps.sql, setup.projectId, labels);
    if (ctx.include.comments) await writeComments(deps.sql, client, rows, pageIssues);
    if (ctx.include.attachments) await writeAttachments(deps.sql, client, rows, pageIssues);
    if (ctx.include.history) await writeHistory(deps.sql, client, rows, pageIssues);
    await scope.progress.advance(page.issues.length);
    cursor = page.next;
    await scope.checkpoint.save({ cursor } satisfies JiraCheckpoint);
    if (!cursor) return;
  }
}

/**
 * Each project's key here, decided before any is written so references across projects
 * resolve: its target's key, else the key made from Jira's. Into an existing project, issue
 * numbers move past the numbers it had, by an offset kept on the mapping for re-runs.
 */
async function localKeys(
  sql: SqlClient,
  projects: readonly JiraProject[],
  ctx: ImportRunContext,
): Promise<Map<string, LocalKey>> {
  const keys = new Map<string, LocalKey>();
  for (const project of projects) {
    const target = ctx.targets.get(project.id);
    if (target?.mode === 'existing' && target.id) {
      const mapped = await ctx.mappings.get('project', project.id);
      const [top] = await sql<{ top: number }[]>`
        select coalesce(max(number), 0)::int as top from issues where project_id = ${target.id}`;
      const offset =
        mapped?.targetId === target.id ? Number(mapped.meta['offset'] ?? 0) : (top?.top ?? 0);
      keys.set(project.key, { key: target.key, offset });
    } else {
      keys.set(project.key, { key: target?.key || projectKeyFrom(project.key), offset: 0 });
    }
  }
  return keys;
}

export async function runJira(
  deps: JiraRunDeps,
  connection: ImportConnection,
  plan: ImportPlan,
  ctx: ImportRunContext,
): Promise<void> {
  const parsed = parseJiraConnection(connection);
  const client = jiraClientFor(connection, ctx);
  let projects;
  let fields;
  try {
    projects = (await client.projects()).filter((project) => plan.containers.includes(project.id));
    fields = await client.fields();
  } catch (error) {
    return explainJiraError(error);
  }
  const projectKeys = await localKeys(deps.sql, projects, ctx);
  const people = new Map<string, { id: string; label: string }>();
  for (const container of await ctx.containers.list()) {
    await ctx.containers.run(container, async (scope) => {
      const summary = projects.find((project) => project.id === container.id);
      if (!summary) throw new Error('The token no longer sees this project');
      const setup = await setupProject(deps, client, summary, ctx, projectKeys.get(summary.key)!);
      const sprints = ctx.include.agile
        ? await importAgile(deps.sql, client, setup, ctx)
        : new Map<string, string>();
      const rows: RowContext = {
        setup,
        fields: createFieldMapper(deps.sql, setup.projectId, fields, ctx),
        sprints,
        ctx,
        people,
        siteUrl: parsed.baseUrl,
        projectKeys,
        cloud: parsed.deployment === 'cloud',
      };
      await importIssues(deps, client, rows, scope);
    });
  }
  const done = await ctx.containers.done();
  const made = await ctx.mappings.getMany(
    'project',
    done.map((container) => container.id),
  );
  const imported = new Set([...made.values()].map((row) => row.targetId));
  if (ctx.include.links) await writeLinks(deps.sql, imported, ctx);
}
