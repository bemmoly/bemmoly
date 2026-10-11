import {
  aiRefusal,
  createContextWriter,
  type AiTargetContextBuilder,
  type ContextWriter,
  type SqlExecutor,
} from '@bemmoly/core';
import { projectResource } from '../issues/deps.ts';
import { issuePath } from '../issues/notify.ts';
import {
  issueLastChangedAt,
  nameIds,
  readBlockers,
  readHistorySince,
  readIssueFacts,
  readRecentComments,
  type HistoryFacts,
  type IssueFacts,
} from './issue-rows.ts';

/** How much of an issue the summary reads. */
export const ISSUE_CONTEXT_LIMITS = { comments: 12, history: 20, chars: 14_000 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

function fieldsLine(issue: IssueFacts): string {
  const parts = [
    `${issue.type}`,
    `status ${issue.status}`,
    `priority ${issue.priority}`,
    `assignee ${issue.assignee ?? 'unassigned'}`,
    issue.reporter ? `reporter ${issue.reporter}` : null,
    issue.estimate ? `estimate ${Number(issue.estimate)} pts` : null,
    issue.sprint ? `sprint ${issue.sprint}` : null,
    issue.dueAt ? `due ${issue.dueAt}` : null,
    issue.parentKey ? `parent ${issue.parentKey}` : null,
    issue.fixVersion ? `fix version ${issue.fixVersion}` : null,
    issue.component ? `component ${issue.component}` : null,
    issue.labels.length > 0 ? `labels ${issue.labels.join(', ')}` : null,
    `in this status since ${day(issue.statusChangedAt)}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

const FIELD_NAMES: Record<string, string> = {
  statusId: 'status',
  assigneeId: 'assignee',
  sprintId: 'sprint',
  fixVersionId: 'fix version',
  componentId: 'component',
  labelIds: 'labels',
  parentId: 'parent',
  dueAt: 'due date',
};

function valueOf(value: unknown, names: Map<string, string>): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (Array.isArray(value)) return value.map((item) => valueOf(item, names)).join(', ') || 'none';
  if (typeof value === 'string') return names.get(value) ?? (UUID.test(value) ? 'another' : value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'changed';
}

function historyLine(entry: HistoryFacts, names: Map<string, string>): string {
  const field = FIELD_NAMES[entry.field] ?? entry.field;
  const who = entry.actor ?? 'Someone';
  if (entry.field === 'description')
    return `${who} edited the description on ${day(entry.createdAt)}`;
  return `${who} changed ${field} from ${valueOf(entry.from, names)} to ${valueOf(entry.to, names)} on ${day(entry.createdAt)}`;
}

function idsIn(entries: readonly HistoryFacts[]): string[] {
  const out = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && UUID.test(value)) out.add(value);
    if (Array.isArray(value)) value.forEach(add);
  };
  for (const entry of entries) {
    add(entry.from);
    add(entry.to);
  }
  return [...out];
}

async function writeIssue(
  sql: SqlExecutor,
  writer: ContextWriter,
  issue: IssueFacts,
  since: Date | null,
): Promise<void> {
  const href = issuePath(issue.key);
  const scope = { projectId: issue.projectId };
  writer.heading(`Issue ${issue.key}`);
  writer.cite({
    kind: 'issue',
    objectId: issue.id,
    label: issue.key,
    location: 'description',
    href,
    line: `${issue.key} · ${issue.title} · ${fieldsLine(issue)}`,
    body: issue.description,
    scope: { ...scope, authorId: issue.reporterId },
  });

  const blockers = await readBlockers(sql, issue.id);
  if (blockers.length > 0) writer.heading('Blockers');
  for (const other of blockers) {
    const relation = other.direction === 'blocks' ? `${issue.key} blocks` : 'blocked by';
    writer.cite({
      kind: 'issue',
      objectId: other.id,
      label: other.key,
      location: other.direction === 'blocks' ? 'blocked by this issue' : 'blocks this issue',
      href: issuePath(other.key),
      line: `${relation} ${other.key} · ${other.title} · ${other.status}`,
      scope: { projectId: other.projectId },
    });
  }

  const { comments, total } = await readRecentComments(
    sql,
    issue.id,
    ISSUE_CONTEXT_LIMITS.comments,
  );
  if (comments.length > 0) {
    writer.heading(
      total > comments.length ? `Comments (latest ${comments.length} of ${total})` : 'Comments',
    );
  }
  for (const comment of comments) {
    writer.cite({
      kind: 'comment',
      objectId: comment.id,
      label: `${comment.author ?? 'A comment'}'s comment`,
      location: day(comment.createdAt),
      href,
      line: `${comment.author ?? 'Someone'} commented on ${day(comment.createdAt)}`,
      body: comment.body,
      scope: { ...scope, authorId: comment.authorId },
      counts: 'comments',
    });
  }

  const history = await readHistorySince(sql, issue.id, since, ISSUE_CONTEXT_LIMITS.history);
  const names = await nameIds(sql, idsIn(history));
  if (history.length > 0)
    writer.heading(since ? 'Changes since the last summary' : 'Recent changes');
  for (const entry of history) {
    writer.cite({
      kind: 'history',
      objectId: entry.id,
      label: `${issue.key} history`,
      location: day(entry.createdAt),
      href,
      line: historyLine(entry, names),
      scope,
      counts: 'changes',
    });
  }
}

/**
 * issueContext (tech design 11.3): title, description, fields, the last comments, history
 * since the last summary, blockers and, through Docs, the linked pages' TL;DRs. An issue in
 * an excluded project is refused, never summarised from its title alone.
 */
export function createIssueContextBuilder(
  sql: () => SqlExecutor | undefined,
): AiTargetContextBuilder {
  return {
    type: 'target',
    targetKind: 'issue',
    async canView(ctx, id) {
      const db = sql();
      if (!db || !UUID.test(id)) return false;
      const [row] = await db<{ project_id: string }[]>`
        select project_id from issues where id = ${id} and deleted_at is null`;
      return row
        ? ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(row.project_id))
        : false;
    },
    async build(id, options) {
      const db = sql();
      if (!db) return null;
      const issue = await readIssueFacts(db, id);
      if (!issue) return null;
      const writer = createContextWriter({
        policy: options.policy,
        maxChars: ISSUE_CONTEXT_LIMITS.chars,
      });
      if (writer.excluded({ projectId: issue.projectId })) throw aiRefusal('excluded');
      await writeIssue(db, writer, issue, options.since);
      await options.related?.(writer, { kind: 'issue.links', id: issue.id });
      return writer.build({ projectId: issue.projectId }, { key: issue.key, title: issue.title });
    },
    async lastChangedAt(id) {
      const db = sql();
      return db ? issueLastChangedAt(db, id) : null;
    },
  };
}
