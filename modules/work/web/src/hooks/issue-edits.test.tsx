import type { Backlog, BoardView, Issue } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { backlogKeys } from '../api/index.ts';
import { id, keysOf, sampleBacklog, sprint } from '../backlog/fixtures.test-helper.ts';
import { newClient, providers, startServer } from '../backlog/test-support.tsx';
import { workKeys } from '../shared/keys.ts';
import { backlogQuery } from './backlog-data.ts';
import { BOARD_ID, card, testView } from './board-fixtures.ts';
import { findIssue, patchBacklog } from './issue-edit-backlog.ts';
import { useIssueEdits, useIssuePending } from './issue-edits.ts';

const ME = id(0x990);
const s15 = sprint(15).id;
const backlogKey = backlogKeys.backlog('PLT');
const viewKey = workKeys.boardView(BOARD_ID, {});

/** Keys the server refuses, and a gate every answer waits on so the painted state shows. */
let refused = new Set<string>();
let gate: Promise<void> = Promise.resolve();
let release = () => {};
let reads = 0;
/** Answers held for one issue alone, whatever the shared gate does. */
const holds = new Map<string, Promise<void>>();
/** What the server holds; accepted edits are written into it. */
let stored = sampleBacklog();

const hold = () => {
  gate = new Promise((resolve) => (release = resolve));
};

const { calls } = startServer(
  http.get('*/api/v1/work/projects/PLT/backlog', () => {
    reads += 1;
    return HttpResponse.json(stored);
  }),
  http.patch('*/api/v1/work/issues/:key', async ({ params, request }) => {
    const key = String(params['key']);
    await (holds.get(key) ?? gate);
    if (refused.has(key)) {
      return HttpResponse.json(
        { code: 'forbidden', message: `You cannot edit ${key}`, requestId: 't' },
        { status: 403 },
      );
    }
    const body = (await request.json()) as object;
    stored = patchBacklog(stored, key, body);
    return HttpResponse.json(findIssue(stored, key) as Issue);
  }),
);

function setup(pendingKey = 'PLT-1') {
  refused = new Set();
  holds.clear();
  reads = 0;
  stored = sampleBacklog();
  gate = Promise.resolve();
  const client = newClient();
  client.setQueryData(backlogKey, sampleBacklog());
  client.setQueryData(viewKey, testView([card(1), card(2, { rank: 'n' })]));
  const hook = renderHook(
    () => {
      useQuery(backlogQuery('PLT'));
      return { update: useIssueEdits(), pending: useIssuePending(pendingKey) };
    },
    { wrapper: providers(client) },
  );
  const backlog = () => client.getQueryData<Backlog>(backlogKey)!;
  const view = () => client.getQueryData<BoardView>(viewKey)!;
  const cardOf = (key: string) => view().cards.find((entry) => entry.key === key);
  return { client, hook, backlog, cardOf };
}

describe('useIssueEdits', () => {
  it('paints every cache at once and keeps the edits the server took when one is refused', async () => {
    const { hook, backlog, cardOf } = setup();
    hold();
    refused = new Set(['PLT-2']);
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = hook.result.current.update(['PLT-1', 'PLT-2'], { assigneeId: ME });
    });
    expect(findIssue(backlog(), 'PLT-1')?.assigneeId).toBe(ME);
    expect(findIssue(backlog(), 'PLT-2')?.assigneeId).toBe(ME);
    expect(cardOf('PLT-2')?.assigneeId).toBe(ME);
    release();
    await act(() => done);
    expect(findIssue(backlog(), 'PLT-2')?.assigneeId).toBeNull();
    expect(cardOf('PLT-2')?.assigneeId).toBeNull();
    expect(cardOf('PLT-1')?.assigneeId).toBe(ME);
    expect(await screen.findByText('1 of 2 issues could not be changed')).toBeTruthy();
    expect(screen.getByText('You cannot edit PLT-2')).toBeTruthy();
  });

  it('says which issue could not be changed when the only one is refused', async () => {
    const { hook, backlog } = setup();
    refused = new Set(['PLT-5']);
    await act(() => hook.result.current.update(['PLT-5'], { sprintId: s15 }, 'Moved to Sprint'));
    expect(keysOf(backlog().issues)).toEqual(['PLT-5', 'PLT-6', 'PLT-7']);
    expect(backlog().sprints[1]?.committedIssues).toBe(1);
    expect(await screen.findByText('PLT-5 could not be changed')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Moved to Sprint')).toBeNull());
  });

  it('shows the issue as pending until its edit lands', async () => {
    const { hook } = setup('PLT-1');
    hold();
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = hook.result.current.update(['PLT-1'], { priority: 'high' });
    });
    await waitFor(() => expect(hook.result.current.pending).toBe(true));
    release();
    await act(() => done);
    await waitFor(() => expect(hook.result.current.pending).toBe(false));
  });

  it('reads the Work data again only once the last edit in flight settles', async () => {
    const { client, hook } = setup();
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    let held = () => {};
    holds.set('PLT-1', new Promise((resolve) => (held = resolve)));
    act(() => {
      first = hook.result.current.update(['PLT-1'], { priority: 'high' });
    });
    act(() => {
      second = hook.result.current.update(['PLT-5'], { priority: 'low' });
    });
    await act(() => second);
    expect(client.getQueryState(backlogKey)?.isInvalidated).toBe(false);
    expect(reads).toBe(0);
    held();
    await act(() => first);
    await waitFor(() => expect(reads).toBe(1));
  });

  it('sends edits to one issue in order, one at a time', async () => {
    const { hook, backlog } = setup();
    hold();
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = Promise.all([
        hook.result.current.update(['PLT-1'], { priority: 'high' }),
        hook.result.current.update(['PLT-1'], { priority: 'low' }),
      ]);
    });
    expect(findIssue(backlog(), 'PLT-1')?.priority).toBe('low');
    await waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(1);
    release();
    await act(() => done);
    expect(calls.map((call) => call.body)).toEqual([{ priority: 'high' }, { priority: 'low' }]);
  });
});
