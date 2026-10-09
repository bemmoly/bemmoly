import type { Comment, IssueHistoryEntry, WorkLog } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { buildActivity, historyVerb } from './activity-feed.ts';

const comment = (id: string, createdAt: string, parentId: string | null = null) =>
  ({ id, parentId, createdAt }) as Comment;
const entry = (field: string, from: unknown, to: unknown, createdAt = '2026-10-02') =>
  ({ id: field, field, from, to, createdAt, actorId: 'a' }) as IssueHistoryEntry;
const log = { id: 'w', minutes: 240, startedAt: '2026-10-03', userId: 'a' } as WorkLog;

describe('buildActivity', () => {
  const comments = [
    comment('c1', '2026-10-01'),
    comment('r2', '2026-10-05', 'c1'),
    comment('r1', '2026-10-04', 'c1'),
    comment('c2', '2026-10-06'),
  ];
  const history = [entry('priority', 'high', 'highest')];

  it('merges everything newest first with replies under their comment', () => {
    const feed = buildActivity('all', comments, history, [log]);
    expect(feed.map((item) => item.id)).toEqual(['c2', 'w', 'priority', 'c1']);
    const thread = feed.find((item) => item.id === 'c1');
    expect(thread?.kind === 'comment' && thread.replies.map((reply) => reply.id)).toEqual([
      'r1',
      'r2',
    ]);
  });

  it('filters by tab', () => {
    expect(buildActivity('comments', comments, history, [log]).map((i) => i.kind)).toEqual([
      'comment',
      'comment',
    ]);
    expect(buildActivity('work', comments, history, [log]).map((i) => i.kind)).toEqual(['work']);
  });
});

describe('historyVerb', () => {
  const names = {
    status: (id: string) => ({ s1: 'In progress', s2: 'In review' })[id],
    person: () => 'Jonas M.',
  };
  it('reads as the mock words it', () => {
    expect(historyVerb(entry('statusId', 's1', 's2'), names)).toBe(
      'changed status In progress → In review',
    );
    expect(historyVerb(entry('priority', 'high', 'highest'), names)).toBe(
      'changed priority High → Highest',
    );
    expect(historyVerb(entry('assigneeId', null, 'u'), names)).toBe('assigned Jonas M.');
    expect(historyVerb(entry('sprintId', 'a', 'b'), names)).toBe('changed sprint');
  });
});
