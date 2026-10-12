import type {
  ContainerMemberships,
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
import { writeLinks } from './links.ts';
import { setupProject } from './project-setup.ts';
import { projectKeyFrom } from './schema.ts';

/*
 * A Jira run, project by project: configuration, boards and sprints, then issues a page at a
 * time (each page with its labels, comments and attachments), and finally parents and links
 * across everything imported. The checkpoint names the project and the page cursor reached,
 * so a resumed run starts at the first page not yet written; pages are idempotent anyway.
 */

export interface JiraCheckpoint {
  project: number;
  cursor: string | null;
  stage: 'issues' | 'links';
}

export interface JiraRunDeps {
  sql: SqlClient;
  memberships?: ContainerMemberships;
}

async function importIssues(
  deps: JiraRunDeps,
  client: JiraClient,
  rows: RowContext,
  checkpoint: JiraCheckpoint,
): Promise<void> {
  const { ctx, setup } = rows;
  const jql = projectJql(setup.jira.key);
  await ctx.progress.phase(`Issues in ${setup.key}`, await client.countIssues(jql));
  let cursor = checkpoint.cursor;
  for (;;) {
    ctx.signal.throwIfAborted();
    const page = await client.searchIssues(jql, cursor);
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
    await ctx.progress.advance(page.issues.length);
    cursor = page.next;
    await ctx.checkpoint.save({
      ...checkpoint,
      cursor,
      stage: cursor ? 'issues' : 'links',
    } satisfies JiraCheckpoint);
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
  for (const id of plan.containers) {
    if (!projects.some((project) => project.id === id))
      ctx.report.skip('project', id, 'No longer visible to the token');
  }
  const projectKeys = await localKeys(deps.sql, projects, ctx);
  const people = new Map<string, { id: string; label: string }>();
  const saved = ctx.checkpoint.read<JiraCheckpoint>();
  const imported = new Set<string>();
  await ctx.progress.phase('Projects', projects.length);
  for (const [index, summary] of projects.entries()) {
    const setup = await setupProject(deps, client, summary, ctx, projectKeys.get(summary.key)!);
    imported.add(setup.projectId);
    if (saved && index < saved.project) {
      await ctx.progress.advance();
      continue;
    }
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
    const resume = saved && saved.project === index && saved.stage === 'issues';
    await importIssues(deps, client, rows, {
      project: index,
      cursor: resume ? saved.cursor : null,
      stage: 'issues',
    });
    await ctx.checkpoint.save({
      project: index + 1,
      cursor: null,
      stage: 'issues',
    } satisfies JiraCheckpoint);
  }
  if (ctx.include.links) await writeLinks(deps.sql, imported, ctx);
}
