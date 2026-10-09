import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useSprintActions } from '../hooks/backlog-sprints.ts';
import { CompleteSprintDialog } from './complete-sprint-dialog.tsx';
import { issue, sprint, STATUS } from './fixtures.test-helper.ts';
import type { Container, Lookups } from './model.ts';
import { SprintDialog } from './sprint-dialog.tsx';
import { newClient, providers, startServer } from './test-support.tsx';

const future = sprint(15, {
  startsAt: '2026-10-07T00:00:00.000Z',
  endsAt: '2026-10-21T23:59:59.000Z',
});
const active = sprint(14, { state: 'active' });
let refuseStart = false;

const { calls } = startServer(
  http.patch('*/api/v1/work/sprints/:id', () => HttpResponse.json(future)),
  http.post('*/api/v1/work/sprints/:id/start', () =>
    refuseStart
      ? HttpResponse.json(
          {
            code: 'conflict',
            message: 'PLT Sprint 14 is still active; close it first',
            requestId: 't',
          },
          { status: 409 },
        )
      : HttpResponse.json({ ...future, state: 'active' }),
  ),
  http.post('*/api/v1/work/sprints/:id/complete', () =>
    HttpResponse.json({ ...active, state: 'closed' }),
  ),
  http.post('*/api/v1/work/projects/PLT/sprints', () =>
    HttpResponse.json(sprint(16), { status: 201 }),
  ),
  http.delete('*/api/v1/work/sprints/:id', () => new HttpResponse(null, { status: 204 })),
);

const lookups: Lookups = {
  statuses: new Map([
    [STATUS.todo, { label: 'To do', category: 'todo', done: false }],
    [STATUS.done, { label: 'Done', category: 'done', done: true }],
  ]),
  types: new Map(),
  people: new Map(),
  epics: new Map(),
};

function Start(props: { mode: 'start' | 'edit'; onClose: () => void }) {
  const actions = useSprintActions('PLT');
  return (
    <SprintDialog
      mode={props.mode}
      sprint={future}
      cadenceDays={14}
      issueCount={5}
      committedPoints={19}
      actions={actions}
      onClose={props.onClose}
    />
  );
}

function Complete({ onClose }: { onClose: () => void }) {
  const actions = useSprintActions('PLT');
  const container: Container = {
    id: active.id,
    sprint: active,
    committedPoints: 6,
    issues: [
      issue(1, 'b', { sprintId: active.id, statusId: STATUS.done, estimate: 3 }),
      issue(2, 'c', { sprintId: active.id, estimate: 2 }),
      issue(3, 'd', { sprintId: active.id, estimate: 1 }),
    ],
  };
  return (
    <CompleteSprintDialog
      container={container}
      future={[future]}
      newSprintName="PLT Sprint 16"
      lookups={lookups}
      actions={actions}
      onClose={onClose}
    />
  );
}

const wrapper = () => providers(newClient());

describe('SprintDialog', () => {
  it('starts the sprint on the chosen days, saving a new goal first', async () => {
    refuseStart = false;
    const onClose = vi.fn();
    render(<Start mode="start" onClose={onClose} />, { wrapper: wrapper() });
    expect(screen.getByText('5 issues and 19 points are planned for this sprint.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Sprint goal'), {
      target: { value: 'Ship usage billing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start sprint' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.map((call) => [call.method, call.body])).toEqual([
      ['PATCH', { name: 'PLT Sprint 15', goal: 'Ship usage billing' }],
      ['POST', { startsAt: '2026-10-07T00:00:00.000Z', endsAt: '2026-10-20T23:59:59.000Z' }],
    ]);
  });

  it('will not start a sprint that ends before it starts', () => {
    render(<Start mode="start" onClose={() => {}} />, { wrapper: wrapper() });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('The sprint has to end on or after the day it starts.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start sprint' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('shows the server refusal in place and stays open', async () => {
    refuseStart = true;
    const onClose = vi.fn();
    render(<Start mode="start" onClose={onClose} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Start sprint' }));
    expect((await screen.findByRole('alert')).textContent).toContain('still active');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('deletes a planned sprint after a second click', async () => {
    const onClose = vi.fn();
    render(<Start mode="edit" onClose={onClose} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Delete sprint' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete and move 5 issues to the backlog' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      { method: 'DELETE', path: `/api/v1/work/sprints/${future.id}`, body: undefined },
    ]);
  });
});

describe('CompleteSprintDialog', () => {
  it('shows completed against unfinished work and moves the rest to the next sprint', async () => {
    const onClose = vi.fn();
    render(<Complete onClose={onClose} />, { wrapper: wrapper() });
    expect(screen.getByText('1 issue')).toBeTruthy();
    expect(screen.getByText('2 issues')).toBeTruthy();
    expect(screen.getAllByText('3 pts')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Complete sprint' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        method: 'POST',
        path: `/api/v1/work/sprints/${active.id}/complete`,
        body: { moveUnfinishedTo: future.id },
      },
    ]);
  });
});
