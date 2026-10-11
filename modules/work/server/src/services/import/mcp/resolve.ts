import type { SqlClient } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { StatusCategory } from '../../../../../shared/enums.ts';
import type { ImportedIssue } from '../../../../../shared/issue-import.ts';
import { loadStatuses, loadWorkflowForProject } from '../../workflow/rows.ts';

/*
 * What a batch names, looked up once: the project, its types and workflow statuses by name
 * and id, and people by email. People are only matched, never made: an agent's import should
 * not add accounts, so an unknown address is left out and reported.
 */

export interface ImportProject {
  id: string;
  key: string;
}

export interface ImportLookups {
  type(nameOrId: string): string | null;
  status(nameOrId: string): { id: string; category: StatusCategory } | null;
  /** Active or invited users by lower-cased email. */
  users: ReadonlyMap<string, string>;
}

export async function loadProject(sql: SqlClient, key: string): Promise<ImportProject> {
  const [row] = await sql<ImportProject[]>`
    select id, key from projects where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError('The project was not found');
  return row;
}

const byNameOrId = <T extends { id: string; name: string }>(rows: readonly T[]) => {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.name.toLowerCase(), row);
  for (const row of rows) map.set(row.id.toLowerCase(), row);
  return (value: string) => map.get(value.trim().toLowerCase()) ?? null;
};

export async function loadLookups(
  sql: SqlClient,
  projectId: string,
  issues: readonly ImportedIssue[],
): Promise<ImportLookups> {
  const types = await sql<{ id: string; name: string; key: string }[]>`
    select id, name, key from issue_types
    where project_id = ${projectId} or project_id is null
    order by project_id nulls last, id`;
  // A project's own type wins over the org default of the same name.
  const named = [...types].reverse();
  const typeOf = byNameOrId([...named.map((row) => ({ id: row.id, name: row.key })), ...named]);
  const workflow = await loadWorkflowForProject(sql, projectId);
  if (!workflow) throw new ValidationError('The project has no workflow');
  const statusOf = byNameOrId(await loadStatuses(sql, workflow.id));
  const emails = [
    ...new Set(
      issues.flatMap((issue) => [
        issue.assigneeEmail,
        issue.reporterEmail,
        ...(issue.comments ?? []).map((comment) => comment.authorEmail),
      ]),
    ),
  ].filter((email): email is string => Boolean(email));
  const people = emails.length
    ? await sql<{ id: string; email: string }[]>`
        select id, lower(email) as email from users
        where lower(email) = any(${emails}::text[]) and status <> 'deactivated'`
    : [];
  return {
    type: (value) => typeOf(value)?.id ?? null,
    status: (value) => {
      const status = statusOf(value);
      return status ? { id: status.id, category: status.category } : null;
    },
    users: new Map(people.map((person) => [person.email, person.id])),
  };
}

/** "TRP-12" is 12; a key with no trailing number has none to keep. */
export function trailingNumber(externalKey: string): number | null {
  const match = /(\d+)$/.exec(externalKey);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 && number < 2_000_000_000 ? number : null;
}

/**
 * Numbers for issues not imported before: the source's own number when the project has no
 * issue with it, else the next free one. Taken under the counter row's lock, and the counter
 * is moved past every number handed out, so a create running alongside never takes one.
 */
export async function reserveNumbers(
  sql: SqlClient,
  projectId: string,
  externalKeys: readonly string[],
): Promise<Map<string, number>> {
  const numbers = new Map<string, number>();
  if (!externalKeys.length) return numbers;
  await sql`
    insert into project_counters (project_id) values (${projectId})
    on conflict (project_id) do nothing`;
  await sql.begin(async (tx) => {
    const [counter] = await tx<{ next_number: number }[]>`
      select next_number from project_counters where project_id = ${projectId} for update`;
    const wanted = externalKeys
      .map(trailingNumber)
      .filter((number): number is number => number !== null);
    const used = await tx<{ number: number }[]>`
      select number from issues
      where project_id = ${projectId} and number = any(${wanted}::int[])`;
    const taken = new Set(used.map((row) => row.number));
    const later: string[] = [];
    for (const key of externalKeys) {
      const number = trailingNumber(key);
      if (number === null || taken.has(number)) later.push(key);
      else {
        taken.add(number);
        numbers.set(key, number);
      }
    }
    const [top] = await tx<{ max: number | null }[]>`
      select max(number) as max from issues where project_id = ${projectId}`;
    let next = Math.max(counter?.next_number ?? 1, (top?.max ?? 0) + 1);
    for (const key of later) {
      while (taken.has(next)) next += 1;
      taken.add(next);
      numbers.set(key, next);
    }
    const highest = Math.max(next - 1, ...numbers.values());
    await tx`
      update project_counters set next_number = greatest(next_number, ${highest + 1}),
        updated_at = now()
      where project_id = ${projectId}`;
  });
  return numbers;
}
