import type { BoardView } from '@bemmoly/module-work/shared';
import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { workKeys } from '../shared/index.ts';
import { planMove } from './board-drag.ts';
import { BOARD_ID, EPIC, STATUS, testView } from './board-fixtures.ts';
import { buildBoardModel, locateCard } from './board-model.ts';
import { refusalOf, useBoardMove } from './board-move.ts';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const issue = {
  id: '018f0000-0000-7000-8000-00000000006e',
  projectId: '018f0000-0000-7000-8000-000000000050',
  number: 10,
  key: 'PLT-10',
  typeId: '018f0000-0000-7000-8000-000000000046',
  title: 'Issue 10',
  description: null,
  descriptionText: '',
  statusId: STATUS.doing,
  priority: 'medium',
  assigneeId: null,
  reporterId: null,
  parentId: null,
  sprintId: null,
  estimate: null,
  dueAt: null,
  fixVersionId: null,
  componentId: null,
  customFields: {},
  labelIds: [],
  rank: 'bn',
  statusChangedAt: '2026-10-09T00:00:00.000Z',
  resolvedAt: null,
  deletedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const view = testView();
  client.setQueryData(workKeys.boardView(BOARD_ID, {}), view);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  const heard: string[] = [];
  const announce = (text: string) => void heard.push(text);
  const hook = renderHook(() => useBoardMove(BOARD_ID, (id) => id, announce), { wrapper });
  const model = buildBoardModel(view);
  const planFor = (index: number) => {
    const card = view.cards[index];
    const from = card ? locateCard(model, card.issueId) : null;
    if (!card || !from) throw new Error('no card');
    const plan = planMove(
      model,
      card,
      from,
      { laneId: EPIC, columnId: 'doing', index: 0 },
      STATUS.doing,
    );
    if (!plan) throw new Error('no plan');
    return plan;
  };
  const plan = planFor(0);
  const cached = () => client.getQueryData<BoardView>(workKeys.boardView(BOARD_ID, {}));
  const columnOf = (issueId = plan.issueId) =>
    cached()?.cards.find((entry) => entry.issueId === issueId)?.columnId;
  return { client, hook, plan, planFor, columnOf, cached, heard };
}

/** A promise the test resolves when it wants a held response to go. */
function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
}

const refusal = () =>
  HttpResponse.json(
    {
      code: 'validation_failed',
      message: 'The transition is blocked',
      details: { reasons: ['Link a pull request first.'] },
      requestId: 'r1',
    },
    { status: 400 },
  );

const reads = [
  http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
  http.get('*/api/v1/work/boards/:id/metrics', () => HttpResponse.json({})),
];

describe('useBoardMove', () => {
  it('moves the card in the same frame, then transitions and ranks it', async () => {
    const calls: string[] = [];
    server.use(
      http.patch('*/api/v1/work/issues/:key', async ({ request, params }) => {
        calls.push(`status ${params['key']} ${JSON.stringify(await request.json())}`);
        return HttpResponse.json(issue);
      }),
      http.patch('*/api/v1/work/issues/:key/rank', async ({ request }) => {
        calls.push(`rank ${JSON.stringify(await request.json())}`);
        return HttpResponse.json(issue);
      }),
      http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
      http.get('*/api/v1/work/boards/:id/metrics', () => HttpResponse.json({})),
    );
    const { hook, plan, columnOf } = setup();
    act(() => hook.result.current.move(plan, 1));
    expect(columnOf()).toBe('doing');
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toBe(`status PLT-10 {"statusId":"${STATUS.doing}"}`);
    expect(calls[1]).toContain('"afterIssueId"');
  });

  it("forgets the issue's transitions once it moves, so the next pick-up reads the new status", async () => {
    server.use(
      http.patch('*/api/v1/work/issues/:key', () => HttpResponse.json(issue)),
      http.patch('*/api/v1/work/issues/:key/rank', () => HttpResponse.json(issue)),
      http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
      http.get('*/api/v1/work/boards/:id/metrics', () => HttpResponse.json({})),
    );
    const { client, hook, plan } = setup();
    client.setQueryData(workKeys.issueTransitions(plan.key), []);
    act(() => hook.result.current.move(plan, 1));
    await waitFor(() =>
      expect(client.getQueryState(workKeys.issueTransitions(plan.key))?.isInvalidated).toBe(true),
    );
  });

  it('reads the board again only once the last of several quick moves settles', async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.patch('*/api/v1/work/issues/:key', async ({ params }) => {
        if (params['key'] !== 'PLT-10') await held;
        return HttpResponse.json(issue);
      }),
      http.patch('*/api/v1/work/issues/:key/rank', () => HttpResponse.json(issue)),
      http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
      http.get('*/api/v1/work/boards/:id/metrics', () => HttpResponse.json({})),
    );
    const { client, hook, plan, columnOf } = setup();
    const later = { ...plan, issueId: 'other', key: 'PLT-11' };
    act(() => hook.result.current.move(later, 1));
    act(() => hook.result.current.move(plan, 1));
    const stale = () => client.getQueryState(workKeys.boardView(BOARD_ID, {}))?.isInvalidated;
    await waitFor(() => expect(client.isMutating()).toBe(1));
    expect(stale()).toBe(false);
    expect(columnOf()).toBe('doing');
    release();
    await waitFor(() => expect(stale()).toBe(true));
  });

  it('puts the card back and says why when the workflow refuses', async () => {
    server.use(http.patch('*/api/v1/work/issues/:key', refusal), ...reads);
    const { hook, plan, columnOf } = setup();
    act(() => hook.result.current.move(plan, 1));
    expect(columnOf()).toBe('doing');
    await waitFor(() => expect(columnOf()).toBe('todo'));
    await waitFor(() => expect(document.body.textContent).toContain('Link a pull request first.'));
    expect(document.body.textContent).toContain('PLT-10 stays in todo');
  });

  it('puts back only the refused card, not one dropped after it that is still in flight', async () => {
    const refused = gate();
    const pending = gate();
    server.use(
      http.patch('*/api/v1/work/issues/:key', async ({ params }) => {
        if (params['key'] === 'PLT-10') {
          await refused.opened;
          return refusal();
        }
        await pending.opened;
        return HttpResponse.json(issue);
      }),
      http.patch('*/api/v1/work/issues/:key/rank', () => HttpResponse.json(issue)),
      ...reads,
    );
    const { hook, plan, planFor, columnOf, cached } = setup();
    const second = planFor(1);
    act(() => hook.result.current.move(plan, 1));
    act(() => hook.result.current.move(second, 1));
    expect([columnOf(), columnOf(second.issueId)]).toEqual(['doing', 'doing']);
    refused.open();
    await waitFor(() => expect(columnOf()).toBe('todo'));
    expect(columnOf(second.issueId)).toBe('doing');
    const counts = cached()?.columns.map((column) => [column.id, column.count]);
    expect(counts).toEqual([
      ['todo', 2],
      ['doing', 3],
      ['done', 1],
    ]);
    pending.open();
  });

  it('announces the move as pending at the drop and as done once the server agrees', async () => {
    const held = gate();
    server.use(
      http.patch('*/api/v1/work/issues/:key', async () => {
        await held.opened;
        return HttpResponse.json(issue);
      }),
      http.patch('*/api/v1/work/issues/:key/rank', () => HttpResponse.json(issue)),
      ...reads,
    );
    const { hook, plan, heard } = setup();
    act(() => hook.result.current.move(plan, 1));
    expect(heard).toEqual(['PLT-10 moving to doing, position 1.']);
    held.open();
    await waitFor(() => expect(heard.at(-1)).toBe('PLT-10 moved to doing.'));
  });

  it('announces a refusal with its reason and never that the card moved', async () => {
    server.use(http.patch('*/api/v1/work/issues/:key', refusal), ...reads);
    const { hook, plan, heard } = setup();
    act(() => hook.result.current.move(plan, 1));
    await waitFor(() =>
      expect(heard.at(-1)).toBe('PLT-10 did not move to doing. Link a pull request first.'),
    );
    expect(heard).not.toContain('PLT-10 moved to doing.');
  });
});

describe('refusalOf', () => {
  it('falls back to the error message without workflow reasons', () => {
    expect(refusalOf(new Error('Network down'))).toBe('Network down');
    expect(refusalOf('nope')).toBe('The move did not go through.');
  });
});
