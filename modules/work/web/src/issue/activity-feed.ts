import type { Comment, IssueHistoryEntry, WorkLog } from '@bemmoly/module-work/shared';
import { PRIORITIES, type Priority } from '@bemmoly/ui';
import { formatMinutes } from './vocabulary.ts';

export type ActivityFilter = 'all' | 'comments' | 'history' | 'work';

export type ActivityEntry =
  | { kind: 'comment'; id: string; at: string; comment: Comment; replies: Comment[] }
  | { kind: 'history'; id: string; at: string; entry: IssueHistoryEntry }
  | { kind: 'work'; id: string; at: string; log: WorkLog };

/**
 * Comments with their replies, history and work log as one list, newest first, filtered by
 * the Activity tabs. Replies stay under their comment, oldest first, as a thread reads.
 */
export function buildActivity(
  filter: ActivityFilter,
  comments: readonly Comment[],
  history: readonly IssueHistoryEntry[],
  logs: readonly WorkLog[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  if (filter === 'all' || filter === 'comments') {
    const replies = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      replies.set(comment.parentId, [...(replies.get(comment.parentId) ?? []), comment]);
    }
    for (const comment of comments) {
      if (comment.parentId) continue;
      const thread = (replies.get(comment.id) ?? []).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      entries.push({
        kind: 'comment',
        id: comment.id,
        at: comment.createdAt,
        comment,
        replies: thread,
      });
    }
  }
  if (filter === 'all' || filter === 'history') {
    for (const entry of history)
      entries.push({ kind: 'history', id: entry.id, at: entry.createdAt, entry });
  }
  if (filter === 'all' || filter === 'work') {
    for (const log of logs) entries.push({ kind: 'work', id: log.id, at: log.startedAt, log });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export interface HistoryNames {
  status: (id: string) => string | undefined;
  person: (id: string) => string;
}

const FIELD_NAMES: Record<string, string> = {
  statusId: 'status',
  assigneeId: 'assignee',
  sprintId: 'sprint',
  fixVersionId: 'fix version',
  componentId: 'component',
  parentId: 'parent',
  typeId: 'type',
  labelIds: 'labels',
  dueAt: 'due date',
  estimate: 'estimate',
  description: 'the description',
  customFields: 'a custom field',
};

const shown = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null;

/** "changed status from In progress to In review", "changed priority from High to Highest", "logged 4h". */
export function historyVerb(entry: IssueHistoryEntry, names: HistoryNames): string {
  const { field, from, to } = entry;
  if (field === 'statusId') {
    const before = names.status(String(from)) ?? 'another status';
    const after = names.status(String(to)) ?? 'another status';
    return `changed status from ${before} to ${after}`;
  }
  if (field === 'priority') {
    const label = (value: unknown) => PRIORITIES[value as Priority]?.name ?? String(value);
    return `changed priority from ${label(from)} to ${label(to)}`;
  }
  if (field === 'assigneeId') {
    return to ? `assigned ${names.person(String(to))}` : 'removed the assignee';
  }
  if (field === 'title') return 'renamed the issue';
  // The issue's own lifecycle rows carry no field to name.
  if (field === 'created') return 'created the issue';
  if (field === 'deleted') return to ? 'deleted the issue' : 'restored the issue';
  const name = FIELD_NAMES[field] ?? field.replace(/_/g, ' ');
  const before = shown(from);
  const after = shown(to);
  if (field === 'estimate' && after !== null) return `set the estimate to ${after}`;
  if (field.endsWith('Id') || before === null || after === null) return `changed ${name}`;
  return `changed ${name} from ${before} to ${after}`;
}

export const workVerb = (log: WorkLog) => `logged ${formatMinutes(log.minutes)}`;
