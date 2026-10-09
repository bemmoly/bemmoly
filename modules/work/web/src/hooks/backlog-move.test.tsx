import type { Backlog } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { backlogKeys } from '../api/index.ts';
import { id, keysOf, sampleBacklog } from '../backlog/fixtures.test-helper.ts';
import { BACKLOG_ID } from '../backlog/model.ts';
import { newClient, providers, startServer } from '../backlog/test-support.tsx';
import { backlogQuery } from './backlog-data.ts';
import { useMoveIssues } from './backlog-move.ts';

const issueId = (n: number) => id(0xb00 + n);
const key = backlogKeys.backlog('PLT');

let serverBacklog = sampleBacklog();
let failMoves = false;
/** Holds every move answer until the test lets it go, so the optimistic state can be seen. */
let gate: Promise<void> = Promise.resolve();
let release = () => {};

const { calls } = startServer(
  http.get('*/api/v1/work/projects/PLT/backlog', () => HttpResponse.json(serverBacklog)),
  http.post('*/api/v1/work/issues/:key/move', async ({ params }) => {
    await gate;
    if (failMoves) {
      return HttpResponse.json(
        { code: 'validation_failed', message: 'The sprint is closed', requestId: 't' },
        { status: 400 },
      );
    }
    const all = [...serverBacklog.sprints.flatMap((s) => s.issues), ...serverBacklog.issues];
    const moved = all.find((issue) => issue.key === params['key']);
    return HttpResponse.json({ ...moved, rank: 'zz' });
  }),
);

function setup() {
  const client = newClient();
  client.setQueryData(key, sampleBacklog());
  /** The screen observes the read, which is what makes the settle refetch it. */
  const hook = renderHook(
    () => {
      useQuery(backlogQuery('PLT'));
      return useMoveIssues('PLT');
    },
    { wrapper: providers(client) },
  );
  return { client, hook };
}

describe('useMoveIssues', () => {
  it('paints the drop at once, sends one call per issue in order and then refetches', async () => {
    serverBacklog = sampleBacklog();
    failMoves = false;
    gate = new Promise((resolve) => (release = resolve));
    const { client, hook } = setup();
    const visible = sampleBacklog().issues.map((issue) => issue.id);

    let planned = false;
    act(() => {
      planned = hook.result.current.drop(
        [issueId(6), issueId(1)],
        { containerId: BACKLOG_ID, beforeId: issueId(5) },
        visible,
      );
    });
    expect(planned).toBe(true);
    await waitFor(() =>
      expect(keysOf(client.getQueryData<Backlog>(key)!.issues)).toEqual([
        'PLT-1',
        'PLT-6',
        'PLT-5',
        'PLT-7',
      ]),
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    release();
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.map((call) => [call.path, call.body])).toEqual([
      [
        '/api/v1/work/issues/PLT-1/move',
        { beforeIssueId: null, afterIssueId: issueId(5), sprintId: null },
      ],
      ['/api/v1/work/issues/PLT-6/move', { beforeIssueId: issueId(1), afterIssueId: issueId(5) }],
    ]);
    await waitFor(() => expect(hook.result.current.isMoving).toBe(false));
    await waitFor(() =>
      expect(keysOf(client.getQueryData<Backlog>(key)!.issues)).toEqual([
        'PLT-5',
        'PLT-6',
        'PLT-7',
      ]),
    );
  });

  it('puts the backlog back when the server refuses the move', async () => {
    serverBacklog = sampleBacklog();
    failMoves = true;
    const { client, hook } = setup();
    const s15 = sampleBacklog().sprints[1]!.sprint.id;
    act(() => {
      hook.result.current.drop([issueId(5)], { containerId: s15, beforeId: null }, [issueId(4)]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(hook.result.current.isMoving).toBe(false));
    expect(keysOf(client.getQueryData<Backlog>(key)!.issues)).toEqual(['PLT-5', 'PLT-6', 'PLT-7']);
  });

  it('sends nothing for a drop that changes nothing', () => {
    const { hook } = setup();
    let planned = true;
    act(() => {
      planned = hook.result.current.drop(
        [issueId(5)],
        { containerId: BACKLOG_ID, beforeId: issueId(6) },
        [issueId(5), issueId(6), issueId(7)],
      );
    });
    expect(planned).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
