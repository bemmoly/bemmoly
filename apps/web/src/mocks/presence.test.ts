import { describe, expect, it } from 'vitest';
import { createMockDb } from './db.ts';
import { mockPresence } from './presence.ts';
import { USER_IDS } from './seed/people.ts';

const project = { kind: 'project', id: 'p1' } as const;
const join = (view: string) => ({ type: 'presence', scope: project, view });

describe('mock presence', () => {
  const db = createMockDb('ready');
  const now = Date.parse('2026-10-10T09:00:00Z');

  it('puts two teammates on a board and one reader on an issue, never the viewer', () => {
    const board = mockPresence(db, join('board'), now);
    expect(board).toMatchObject({ type: 'presence', scope: project });
    const people = board?.type === 'presence' ? board.people : [];
    expect(people.map((entry) => entry.userId)).toEqual([USER_IDS.priya, USER_IDS.aisha]);
    expect(people.every((entry) => entry.userId !== db.signedInAs)).toBe(true);
    const issue = mockPresence(db, join('issue:PLT-204'), now);
    expect(issue?.type === 'presence' && issue.people).toHaveLength(1);
  });

  it('leaves the backlog empty and ignores anything that is not a presence join', () => {
    const backlog = mockPresence(db, join('backlog'), now);
    expect(backlog?.type === 'presence' && backlog.people).toEqual([]);
    expect(mockPresence(db, { type: 'subscribe', scope: project })).toBeNull();
    expect(mockPresence(db, join('Not a view'))).toBeNull();
    expect(mockPresence(db, null)).toBeNull();
  });
});
