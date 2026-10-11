import type {
  ContainerMemberships,
  ImportConnection,
  ImportRunContext,
  SqlClient,
} from '@bemmoly/core';
import { fromMarkdown, plainText } from '@bemmoly/editor/convert';
import { PROJECT_ADMIN_ROLE_KEY } from '../../../../../shared/members.ts';
import { writeLinks } from '../jira/links.ts';
import { ensureStatuses } from '../jira/project-setup.ts';
import { matchIssueType, workTypes } from '../jira/schema.ts';
import { writeIssues, writeLabels, type ImportedIssueRow } from '../writer.ts';
import { mapColumns, type CsvTarget } from './columns.ts';
import { parseCsv } from './parse.ts';

/*
 * A CSV of issues into one project, a page of rows at a time. A row's key (or its row number
 * when the file has no key column) is its source id, so importing the same file again into
 * the same project updates what the first import made.
 */

const PAGE = 250;
const PRIORITIES: Record<string, ImportedIssueRow['priority']> = {
  urgent: 'highest',
  highest: 'highest',
  critical: 'highest',
  blocker: 'highest',
  high: 'high',
  major: 'high',
  medium: 'medium',
  normal: 'medium',
  none: 'medium',
  low: 'low',
  minor: 'low',
  lowest: 'lowest',
  trivial: 'lowest',
};
const DONE = /done|closed|resolved|complete|finished|shipped/i;
const STARTED = /progress|review|doing|testing|started|active/i;

export interface CsvRunDeps {
  sql: SqlClient;
  memberships?: ContainerMemberships;
}

export const csvProjectKey = (connection: ImportConnection) =>
  (connection['project'] ?? '').trim().toUpperCase();

async function ensureProject(
  deps: CsvRunDeps,
  connection: ImportConnection,
  ctx: ImportRunContext,
) {
  const key = csvProjectKey(connection);
  const name = (connection['projectName'] ?? '').trim() || key;
  const project = await deps.sql.begin(async (tx) => {
    const [row] = await tx<{ id: string; key: string; inserted: boolean }[]>`
      insert into projects (key, name) values (${key}, ${name.slice(0, 120)})
      on conflict (key) do update set updated_at = projects.updated_at
      returning id, key, (xmax = 0) as inserted`;
    await tx`insert into project_counters (project_id) values (${row!.id}) on conflict do nothing`;
    if (row!.inserted && deps.memberships && ctx.actorUserId) {
      const admin = (await deps.memberships.roles(tx)).find(
        (role) => role.key === PROJECT_ADMIN_ROLE_KEY,
      );
      await deps.memberships.add(
        'project',
        row!.id,
        { userIds: [ctx.actorUserId], ...(admin ? { roleId: admin.id } : {}) },
        tx,
      );
    }
    return row!;
  });
  ctx.report.count('projects', project.inserted ? 'created' : 'updated');
  await ctx.mappings.set('project', key, project.id);
  return project;
}

const numberFrom = (key: string) => {
  const digits = /(\d+)\s*$/.exec(key)?.[1];
  const number = digits ? Number(digits) : NaN;
  return Number.isSafeInteger(number) && number > 0 && number < 2_000_000_000 ? number : null;
};

export async function runCsv(
  deps: CsvRunDeps,
  connection: ImportConnection,
  ctx: ImportRunContext,
): Promise<void> {
  const { headers, rows } = parseCsv(connection['file'] ?? '');
  const columns = mapColumns(headers);
  const cell = (row: string[], target: CsvTarget) => {
    const index = columns.get(target);
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  for (const [index, header] of headers.entries()) {
    if (![...columns.values()].includes(index))
      ctx.report.skip('column', header || `Column ${index + 1}`, 'No issue field matches');
  }
  const project = await ensureProject(deps, connection, ctx);
  const names = [...new Set(rows.map((row) => cell(row, 'status')).filter(Boolean))];
  const statuses = await ensureStatuses(
    deps.sql,
    project,
    names.map((name) => ({
      id: name,
      name,
      statusCategory: {
        key: DONE.test(name) ? 'done' : STARTED.test(name) ? 'indeterminate' : 'new',
      },
    })),
    ctx,
  );
  const [firstTodo] = await deps.sql<{ id: string }[]>`
    select s.id from workflow_statuses s where s.workflow_id = (
      select w.id from workflows w where w.project_id = ${project.id} or w.project_id is null
      order by w.project_id nulls last, w.id limit 1) and s.category = 'todo'
    order by s.position limit 1`;
  const types = await workTypes(deps.sql, project.id);
  const [{ max } = { max: 0 }] = await deps.sql<{ max: number }[]>`
    select coalesce(max(number), 0)::int as max from issues where project_id = ${project.id}`;
  const keyed = rows
    .map((row) => numberFrom(cell(row, 'key')))
    .filter((n): n is number => n !== null);
  let next = Math.max(max, ...keyed, 0) + 1;
  const known = await ctx.mappings.getMany(
    'issue',
    rows.map((row, index) => cell(row, 'key') || `row:${index + 2}`),
  );

  await ctx.progress.phase('Issues', rows.length);
  const start = ctx.checkpoint.read<{ row: number }>()?.row ?? 0;
  for (let offset = start; offset < rows.length; offset += PAGE) {
    ctx.signal.throwIfAborted();
    const page: ImportedIssueRow[] = [];
    const labels = new Map<string, string[]>();
    for (const [position, row] of rows.slice(offset, offset + PAGE).entries()) {
      const line = offset + position + 2;
      const sourceKey = cell(row, 'key');
      const sourceId = sourceKey || `row:${line}`;
      const title = cell(row, 'title');
      if (!title) {
        ctx.report.skip('issue', `Row ${line}`, 'No title');
        continue;
      }
      const statusName = cell(row, 'status');
      const status = statusName ? statuses.get(statusName) : undefined;
      const statusId = status?.id ?? firstTodo?.id;
      const type = matchIssueType({ id: '', name: cell(row, 'type') || 'Task' }, types);
      if (!statusId || !type) {
        ctx.report.skip(
          'issue',
          sourceKey || `Row ${line}`,
          'The project has no status or type to put it in',
        );
        continue;
      }
      const number = numberFrom(sourceKey) ?? (known.has(sourceId) ? 0 : next++);
      const person = async (value: string) =>
        value
          ? ctx.users.match({
              sourceId: value.toLowerCase(),
              email: value.includes('@') ? value : null,
              name: value,
            })
          : null;
      const description = cell(row, 'description') ? fromMarkdown(cell(row, 'description')) : null;
      const estimate = Number(cell(row, 'estimate'));
      const due = /^\d{4}-\d{2}-\d{2}/.exec(cell(row, 'due'))?.[0] ?? null;
      const created = Date.parse(cell(row, 'created'));
      page.push({
        sourceId,
        label: sourceKey || `Row ${line}`,
        number: number || 1,
        key: `${project.key}-${number || 1}`,
        typeId: type.row.id,
        title,
        description,
        descriptionText: description ? plainText(description) : '',
        statusId,
        category: status?.category ?? 'todo',
        priority: PRIORITIES[cell(row, 'priority').toLowerCase()] ?? 'medium',
        assigneeId: await person(cell(row, 'assignee').split(/[,;]/)[0]?.trim() ?? ''),
        reporterId: await person(cell(row, 'reporter')),
        sprintId: null,
        estimate:
          cell(row, 'estimate') && Number.isFinite(estimate) && estimate >= 0 ? estimate : null,
        dueAt: due,
        fixVersionId: null,
        componentId: null,
        customFields: {},
        createdAt: Number.isNaN(created) ? null : new Date(created).toISOString(),
        resolvedAt: null,
        meta: {
          key: sourceKey || null,
          projectId: project.id,
          epicKey: cell(row, 'parent') || null,
        },
      });
      labels.set(
        sourceId,
        cell(row, 'labels')
          .split(/[,;|]/)
          .map((label) => label.trim())
          .filter(Boolean),
      );
    }
    const written = await writeIssues(deps.sql, project.id, page, ctx.mappings, ctx.report);
    await writeLabels(
      deps.sql,
      project.id,
      new Map(written.map((issue) => [issue.id, labels.get(issue.sourceId) ?? []])),
    );
    await ctx.progress.advance(Math.min(PAGE, rows.length - offset));
    await ctx.checkpoint.save({ row: offset + PAGE });
  }
  await writeLinks(deps.sql, new Set([project.id]), ctx);
}
