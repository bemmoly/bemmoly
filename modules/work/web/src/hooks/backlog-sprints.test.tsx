import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, sprint } from '../backlog/fixtures.test-helper.ts';
import { newClient, providers, startServer } from '../backlog/test-support.tsx';
import { useSprintActions } from './backlog-sprints.ts';

const planned = sprint(15, { goal: null });
const echo = async ({ request }: { request: Request }) =>
  HttpResponse.json({ ...planned, ...((await request.json()) as object) });

const { calls } = startServer(
  http.post('*/api/v1/work/projects/PLT/sprints', echo),
  http.patch('*/api/v1/work/sprints/:id', echo),
  http.post('*/api/v1/work/sprints/:id/start', () =>
    HttpResponse.json({ ...planned, state: 'active' }),
  ),
  http.post('*/api/v1/work/sprints/:id/complete', () =>
    HttpResponse.json({ ...planned, state: 'closed' }),
  ),
  http.delete('*/api/v1/work/sprints/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('*/api/v1/work/issues', () => HttpResponse.json({}, { status: 400 })),
);

function setup() {
  return renderHook(() => useSprintActions('PLT'), { wrapper: providers(newClient()) });
}

const START = '2026-10-07T09:00:00.000Z';
const END = '2026-10-21T17:00:00.000Z';

describe('useSprintActions', () => {
  it('saves a changed name and goal before starting with the chosen dates', async () => {
    const { result } = setup();
    await act(() =>
      result.current.start.mutateAsync({
        sprint: planned,
        name: 'PLT Sprint 15',
        goal: 'Ship usage billing',
        startsAt: START,
        endsAt: END,
      }),
    );
    expect(calls.map((call) => [call.method, call.path, call.body])).toEqual([
      [
        'PATCH',
        `/api/v1/work/sprints/${planned.id}`,
        { name: 'PLT Sprint 15', goal: 'Ship usage billing' },
      ],
      ['POST', `/api/v1/work/sprints/${planned.id}/start`, { startsAt: START, endsAt: END }],
    ]);
  });

  it('starts without an edit when name and goal are unchanged', async () => {
    const { result } = setup();
    await act(() =>
      result.current.start.mutateAsync({
        sprint: planned,
        name: planned.name,
        goal: '',
        startsAt: START,
        endsAt: END,
      }),
    );
    expect(calls.map((call) => call.path)).toEqual([`/api/v1/work/sprints/${planned.id}/start`]);
  });

  it('completes a sprint, sending where the unfinished work goes', async () => {
    const { result } = setup();
    const next = id(0xa10);
    await act(() =>
      result.current.complete.mutateAsync({ id: planned.id, body: { moveUnfinishedTo: next } }),
    );
    expect(calls[0]).toMatchObject({
      path: `/api/v1/work/sprints/${planned.id}/complete`,
      body: { moveUnfinishedTo: next },
    });
  });

  it('creates and deletes sprints', async () => {
    const { result } = setup();
    await act(() => result.current.create.mutateAsync('PLT Sprint 16'));
    await act(() => result.current.remove.mutateAsync(planned.id));
    expect(calls.map((call) => [call.method, call.path, call.body])).toEqual([
      [
        'POST',
        '/api/v1/work/projects/PLT/sprints',
        { name: 'PLT Sprint 16', startsAt: null, endsAt: null },
      ],
      ['DELETE', `/api/v1/work/sprints/${planned.id}`, undefined],
    ]);
  });

  it('reports a refused inline create as the mutation error', async () => {
    const { result } = setup();
    act(() => {
      result.current.createIssue.mutate({
        projectId: planned.projectId,
        typeId: id(0x961),
        title: 'Trace IDs',
      });
    });
    await waitFor(() => expect(result.current.createIssue.isError).toBe(true));
  });
});
