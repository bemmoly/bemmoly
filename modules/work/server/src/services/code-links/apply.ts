import type { CodeActivity, SqlExecutor } from '@bemmoly/core';
import type { CodeLinkState } from '@bemmoly/shared';
import { findIssueKeys } from '../../../../shared/code-links.ts';

/*
 * One activity against code_links. A "link" activity finds the issue keys its texts name and
 * upserts one row per issue; an older report never overwrites a newer one. An "update"
 * changes checks or review on the rows that exist; a "remove" deletes them.
 */

export interface TouchedIssue {
  id: string;
  key: string;
  projectId: string;
  statusId: string;
}

/** A linked pull request whose state just changed: the moment a project may move its issue. */
export interface StateChange {
  issue: TouchedIssue;
  from: CodeLinkState | null;
  to: CodeLinkState | null;
}

export interface ActivityOutcome {
  touched: TouchedIssue[];
  changes: StateChange[];
}

interface IssueRow {
  id: string;
  key: string;
  project_id: string;
  status_id: string;
}

const touchedOf = (row: IssueRow): TouchedIssue => ({
  id: row.id,
  key: row.key,
  projectId: row.project_id,
  statusId: row.status_id,
});

const target = (activity: CodeActivity) => ({
  integration: activity.integrationId,
  repository: activity.repository,
  kind: activity.kind,
  externalId: activity.externalId,
});

async function linkActivity(sql: SqlExecutor, activity: CodeActivity): Promise<ActivityOutcome> {
  const keys = findIssueKeys(activity.texts);
  if (keys.length === 0) return { touched: [], changes: [] };
  const issues = await sql<IssueRow[]>`
    select id, key, project_id, status_id from issues
    where key = any(${keys}::text[]) and deleted_at is null`;
  const t = target(activity);
  const outcome: ActivityOutcome = { touched: [], changes: [] };
  for (const issue of issues) {
    const [previous] = await sql<{ state: CodeLinkState | null }[]>`
      select state from code_links
      where issue_id = ${issue.id} and integration_id = ${t.integration}
        and repository = ${t.repository} and kind = ${t.kind} and external_id = ${t.externalId}`;
    const written = await sql<{ id: string }[]>`
      insert into code_links (issue_id, integration_id, kind, repository, external_id, ref, title,
        url, state, checks, review, author, source_updated_at)
      values (${issue.id}, ${t.integration}, ${t.kind}, ${t.repository}, ${t.externalId},
        ${activity.ref}, ${activity.title}, ${activity.url}, ${activity.state}, ${activity.checks},
        ${activity.review}, ${activity.author}, ${activity.occurredAt})
      on conflict (issue_id, integration_id, repository, kind, external_id) do update set
        ref = excluded.ref, title = excluded.title, url = excluded.url, state = excluded.state,
        checks = coalesce(excluded.checks, code_links.checks),
        review = coalesce(excluded.review, code_links.review),
        author = coalesce(excluded.author, code_links.author),
        source_updated_at = excluded.source_updated_at, updated_at = now()
      where code_links.source_updated_at <= excluded.source_updated_at
      returning id`;
    if (written.length === 0) continue;
    outcome.touched.push(touchedOf(issue));
    const from = previous?.state ?? null;
    if (activity.kind === 'pull_request' && from !== activity.state) {
      outcome.changes.push({ issue: touchedOf(issue), from, to: activity.state });
    }
  }
  return outcome;
}

async function updateActivity(sql: SqlExecutor, activity: CodeActivity): Promise<ActivityOutcome> {
  const t = target(activity);
  const rows = await sql<IssueRow[]>`
    with updated as (
      update code_links set checks = coalesce(${activity.checks}, checks),
        review = coalesce(${activity.review}, review), updated_at = now()
      where integration_id = ${t.integration} and repository = ${t.repository}
        and kind = ${t.kind} and external_id = ${t.externalId}
      returning issue_id)
    select i.id, i.key, i.project_id, i.status_id from updated u join issues i on i.id = u.issue_id`;
  return { touched: rows.map(touchedOf), changes: [] };
}

async function removeActivity(sql: SqlExecutor, activity: CodeActivity): Promise<ActivityOutcome> {
  const t = target(activity);
  const rows = await sql<IssueRow[]>`
    with removed as (
      delete from code_links
      where integration_id = ${t.integration} and repository = ${t.repository}
        and kind = ${t.kind} and external_id = ${t.externalId}
      returning issue_id)
    select i.id, i.key, i.project_id, i.status_id from removed r join issues i on i.id = r.issue_id`;
  return { touched: rows.map(touchedOf), changes: [] };
}

export function applyActivity(sql: SqlExecutor, activity: CodeActivity): Promise<ActivityOutcome> {
  if (activity.mode === 'remove') return removeActivity(sql, activity);
  if (activity.mode === 'update') return updateActivity(sql, activity);
  return linkActivity(sql, activity);
}
