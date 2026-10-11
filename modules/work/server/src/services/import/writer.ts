import type { ImportMappingStore, ImportRunContext, SqlClient } from '@bemmoly/core';

/*
 * Writes imported issues in pages: one statement inserts the new ones and one updates the
 * ones an earlier run made, so a 10k-issue project is a hundred round trips, not ten
 * thousand. The mapping row remembers when the issue was last written by an import; an issue
 * edited here since is left alone on a re-run and reported, so an import never overwrites
 * someone's work.
 */

export interface ImportedIssueRow {
  sourceId: string;
  /** What the report names it by: the source key, or the row of a file. */
  label: string;
  number: number;
  key: string;
  typeId: string;
  title: string;
  description: unknown;
  descriptionText: string;
  statusId: string;
  category: 'todo' | 'in_progress' | 'done';
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  assigneeId: string | null;
  reporterId: string | null;
  sprintId: string | null;
  estimate: number | null;
  dueAt: string | null;
  fixVersionId: string | null;
  componentId: string | null;
  customFields: Record<string, unknown>;
  createdAt: string | null;
  resolvedAt: string | null;
  /** Kept on the mapping for the links pass: parent, links, the source key. */
  meta: Record<string, unknown>;
}

export interface WrittenIssue {
  sourceId: string;
  id: string;
  created: boolean;
}

/** Ranks in number order, so the backlog starts in the order the source numbered issues. */
export function rankFor(number: number): string {
  let digits = '';
  let rest = number;
  for (let index = 0; index < 6; index += 1) {
    digits = String.fromCharCode(97 + (rest % 26)) + digits;
    rest = Math.floor(rest / 26);
  }
  return `m${digits}n`;
}

const asRecord = (row: ImportedIssueRow, projectId: string) => ({
  project_id: projectId,
  number: row.number,
  key: row.key,
  type_id: row.typeId,
  title: row.title.slice(0, 500) || row.key,
  description: row.description,
  description_text: row.descriptionText,
  status_id: row.statusId,
  priority: row.priority,
  assignee_id: row.assigneeId,
  reporter_id: row.reporterId,
  sprint_id: row.sprintId,
  estimate: row.estimate,
  due_at: row.dueAt,
  fix_version_id: row.fixVersionId,
  component_id: row.componentId,
  custom_fields: row.customFields,
  rank: rankFor(row.number),
  created_at: row.createdAt,
  resolved_at: row.category === 'done' ? (row.resolvedAt ?? row.createdAt) : null,
});

const RECORDSET = `r(project_id uuid, number int, key text, type_id uuid, title text,
  description jsonb, description_text text, status_id uuid, priority text, assignee_id uuid,
  reporter_id uuid, sprint_id uuid, estimate numeric, due_at date, fix_version_id uuid,
  component_id uuid, custom_fields jsonb, rank text, created_at timestamptz,
  resolved_at timestamptz, id uuid)`;

export async function writeIssues(
  sql: SqlClient,
  projectId: string,
  rows: readonly ImportedIssueRow[],
  mappings: ImportMappingStore,
  report: ImportRunContext['report'],
): Promise<WrittenIssue[]> {
  if (!rows.length) return [];
  const known = await mappings.getMany(
    'issue',
    rows.map((row) => row.sourceId),
  );
  const ids = [...known.values()].map((mapped) => mapped.targetId);
  const current = await sql<{ id: string; updated_at: Date }[]>`
    select id, updated_at from issues where id = any(${ids}::uuid[]) and deleted_at is null`;
  const live = new Map(current.map((row) => [row.id, row.updated_at.getTime()]));
  const toInsert: ImportedIssueRow[] = [];
  const toUpdate: { row: ImportedIssueRow; id: string }[] = [];
  const written: WrittenIssue[] = [];
  for (const row of rows) {
    const mapped = known.get(row.sourceId);
    const stamp = mapped ? live.get(mapped.targetId) : undefined;
    if (!mapped || stamp === undefined) toInsert.push(row);
    else if (stamp > Number(mapped.meta['syncedAt'] ?? 0) + 1000) {
      report.skip('issue', row.label, 'Changed in Bemmoly since the last import; left as it is');
      written.push({ sourceId: row.sourceId, id: mapped.targetId, created: false });
    } else toUpdate.push({ row, id: mapped.targetId });
  }

  const inserted = toInsert.length
    ? await sql<{ id: string; number: number; updated_at: Date }[]>`
        insert into issues (project_id, number, key, type_id, title, description,
          description_text, status_id, priority, assignee_id, reporter_id, sprint_id, estimate,
          due_at, fix_version_id, component_id, custom_fields, rank, created_at, resolved_at)
        select r.project_id, r.number, r.key, r.type_id, r.title, r.description,
          r.description_text, r.status_id, r.priority, r.assignee_id, r.reporter_id,
          r.sprint_id, r.estimate, r.due_at, r.fix_version_id, r.component_id,
          r.custom_fields, r.rank, coalesce(r.created_at, now()), r.resolved_at
        from jsonb_to_recordset(${JSON.stringify(toInsert.map((row) => asRecord(row, projectId)))}::jsonb)
          as ${sql.unsafe(RECORDSET)}
        on conflict do nothing
        returning id, number, updated_at`
    : [];
  const byNumber = new Map(inserted.map((row) => [row.number, row]));
  const fresh: { sourceId: string; targetId: string; meta: Record<string, unknown> }[] = [];
  for (const row of toInsert) {
    const made = byNumber.get(row.number);
    if (!made) {
      report.skip('issue', row.label, `${row.key} already exists in the project`);
      continue;
    }
    written.push({ sourceId: row.sourceId, id: made.id, created: true });
    fresh.push({
      sourceId: row.sourceId,
      targetId: made.id,
      meta: { ...row.meta, syncedAt: made.updated_at.getTime() },
    });
  }

  const updated = toUpdate.length
    ? await sql<{ id: string; updated_at: Date }[]>`
        update issues i set type_id = r.type_id, title = r.title, description = r.description,
          description_text = r.description_text,
          status_changed_at = case when i.status_id = r.status_id then i.status_changed_at else now() end,
          status_id = r.status_id, priority = r.priority, assignee_id = r.assignee_id,
          reporter_id = r.reporter_id, sprint_id = r.sprint_id, estimate = r.estimate,
          due_at = r.due_at, fix_version_id = r.fix_version_id, component_id = r.component_id,
          custom_fields = r.custom_fields, resolved_at = r.resolved_at, updated_at = now()
        from jsonb_to_recordset(${JSON.stringify(toUpdate.map(({ row, id }) => ({ ...asRecord(row, projectId), id })))}::jsonb)
          as ${sql.unsafe(RECORDSET)}
        where i.id = r.id
        returning i.id, i.updated_at`
    : [];
  const stamps = new Map(updated.map((row) => [row.id, row.updated_at.getTime()]));
  for (const { row, id } of toUpdate) {
    written.push({ sourceId: row.sourceId, id, created: false });
    fresh.push({
      sourceId: row.sourceId,
      targetId: id,
      meta: { ...row.meta, syncedAt: stamps.get(id) ?? Date.now() },
    });
  }
  await mappings.setMany('issue', fresh);
  report.count('issues', 'created', inserted.length);
  report.count('issues', 'updated', updated.length);
  await sql`
    update project_counters c set next_number = greatest(c.next_number,
      (select coalesce(max(number), 0) + 1 from issues where project_id = ${projectId})),
      updated_at = now()
    where c.project_id = ${projectId}`;
  return written;
}

/** Replaces the labels of written issues with the source's, creating labels by name. */
export async function writeLabels(
  sql: SqlClient,
  projectId: string,
  labels: ReadonlyMap<string, readonly string[]>,
): Promise<void> {
  if (!labels.size) return;
  const names = [
    ...new Set([...labels.values()].flat().map((name) => name.trim().slice(0, 60))),
  ].filter(Boolean);
  if (names.length) {
    await sql`
      insert into labels (project_id, name)
      select ${projectId}, n from unnest(${names}::text[]) as n
      on conflict (project_id, lower(name)) do nothing`;
  }
  const issueIds = [...labels.keys()];
  await sql`delete from issue_labels where issue_id = any(${issueIds}::uuid[])`;
  const pairs = [...labels.entries()].flatMap(([issueId, list]) =>
    [...new Set(list.map((name) => name.trim().slice(0, 60).toLowerCase()))]
      .filter(Boolean)
      .map((name) => ({ issue_id: issueId, name })),
  );
  if (!pairs.length) return;
  await sql`
    insert into issue_labels (issue_id, label_id)
    select p.issue_id, l.id
    from jsonb_to_recordset(${JSON.stringify(pairs)}::jsonb) as p(issue_id uuid, name text)
    join labels l on l.project_id = ${projectId} and lower(l.name) = p.name
    on conflict do nothing`;
}
