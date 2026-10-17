import type { SqlClient } from '@bemmoly/core';
import type { JiraClient, JiraHistory, JiraIssue } from '../../../clients/jira.ts';
import { matchPerson, type RowContext } from './issue-rows.ts';

/*
 * Change history, when the admin asks for it: each Jira changelog entry becomes rows of Work's
 * issue history, dated when the change happened (and ordered by that, through the row id),
 * with its author matched like any other person. Status, assignee, summary and priority land
 * on Work's own fields; anything else keeps Jira's field name and its before and after text.
 * Each entry is mapped once, so a re-run adds only what is new.
 */

const PRIORITIES = new Set(['highest', 'high', 'medium', 'low', 'lowest']);

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

async function changeOf(
  rows: RowContext,
  item: NonNullable<JiraHistory['items']>[number],
): Promise<Change | null> {
  const field = (item.fieldId ?? item.field ?? '').toLowerCase();
  if (field === 'status') {
    const from = item.from ? rows.setup.statuses.get(item.from)?.id : undefined;
    const to = item.to ? rows.setup.statuses.get(item.to)?.id : undefined;
    if (from && to) return { field: 'statusId', from, to };
  }
  if (field === 'assignee') {
    const person = async (id: string | null | undefined, name: string | null | undefined) =>
      id
        ? matchPerson(
            rows,
            rows.cloud
              ? { accountId: id, displayName: name ?? id }
              : { name: id, displayName: name ?? id },
          )
        : null;
    return {
      field: 'assigneeId',
      from: await person(item.from, item.fromString),
      to: await person(item.to, item.toString),
    };
  }
  if (field === 'summary') return { field: 'title', from: item.fromString, to: item.toString };
  if (field === 'priority') {
    const level = (value: string | null | undefined) => {
      const name = value?.toLowerCase() ?? '';
      return PRIORITIES.has(name) ? name : null;
    };
    const from = level(item.fromString);
    const to = level(item.toString);
    if (to) return { field: 'priority', from, to };
  }
  const name = (item.field ?? item.fieldId ?? '').trim().slice(0, 60);
  if (!name) return null;
  return { field: name, from: item.fromString ?? null, to: item.toString ?? null };
}

/** Writes the history of a page of issues that were just written. */
export async function writeHistory(
  sql: SqlClient,
  client: JiraClient,
  rows: RowContext,
  issues: ReadonlyMap<string, { issue: JiraIssue; id: string }>,
): Promise<void> {
  const { ctx } = rows;
  if (!issues.size) return;
  const byIssue = await client.changelogs([...issues.values()].map((entry) => entry.issue));
  const all = [...byIssue.values()].flat();
  const known = await ctx.mappings.getMany(
    'history',
    all.map((history) => history.id),
  );
  for (const [issueId, histories] of byIssue) {
    const target = issues.get(issueId);
    if (!target) continue;
    for (const history of histories) {
      if (known.has(history.id)) continue;
      const at = history.created ? new Date(history.created) : null;
      if (!at || Number.isNaN(at.getTime())) {
        ctx.report.skip('change', `${target.issue.key} #${history.id}`, 'It has no date');
        continue;
      }
      const actor = await matchPerson(rows, history.author);
      const changes = (
        await Promise.all((history.items ?? []).map((item) => changeOf(rows, item)))
      ).filter((change): change is Change => change !== null);
      if (!changes.length) continue;
      await sql.begin(async (tx) => {
        for (const change of changes) {
          await tx`
            insert into issue_history (id, issue_id, actor_id, field, from_value, to_value,
              created_at)
            values (uuidv7(${at.toISOString()}::timestamptz - now()), ${target.id}, ${actor},
              ${change.field}, ${JSON.stringify(change.from ?? null)}::jsonb,
              ${JSON.stringify(change.to ?? null)}::jsonb, ${at.toISOString()})`;
        }
        await ctx.mappings.set('history', history.id, target.id, {}, tx);
      });
      ctx.report.count('changes', 'created', changes.length);
    }
  }
}
