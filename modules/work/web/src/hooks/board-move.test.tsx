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
  const hook = renderHook(() => useBoardMove(BOARD_ID, (id) => id), { wrapper });
  const model = buildBoardModel(view);
  const card = view.cards[0];
  if (!card) throw new Error('no card');
  const from = locateCard(model, card.issueId);
  if (!from) throw new Error('no place');
  const plan = planMove(
    model,
    card,
    from,
    { laneId: EPIC, columnId: 'doing', index: 0 },
    STATUS.doing,
  );
  if (!plan) throw new Error('no plan');
  const cached = () => client.getQueryData<BoardView>(workKeys.boardView(BOARD_ID, {}));
  const columnOf = () => cached()?.cards.find((entry) => entry.issueId === card.issueId)?.columnId;
  return { hook, plan, columnOf };
}

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
    act(() => hook.result.current.move(plan));
    expect(columnOf()).toBe('doing');
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toBe(`status PLT-10 {"statusId":"${STATUS.doing}"}`);
    expect(calls[1]).toContain('"afterIssueId"');
  });

  it('puts the card back and says why when the workflow refuses', async () => {
    server.use(
      http.patch('*/api/v1/work/issues/:key', () =>
        HttpResponse.json(
          {
            code: 'validation_failed',
            message: 'The transition is blocked',
            details: { reasons: ['Link a pull request first.'] },
            requestId: 'r1',
          },
          { status: 400 },
        ),
      ),
      http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
      http.get('*/api/v1/work/boards/:id/metrics', () => HttpResponse.json({})),
    );
    const { hook, plan, columnOf } = setup();
    act(() => hook.result.current.move(plan));
    expect(columnOf()).toBe('doing');
    await waitFor(() => expect(columnOf()).toBe('todo'));
    await waitFor(() => expect(document.body.textContent).toContain('Link a pull request first.'));
    expect(document.body.textContent).toContain('PLT-10 stays in todo');
  });
});

describe('refusalOf', () => {
  it('falls back to the error message without workflow reasons', () => {
    expect(refusalOf(new Error('Network down'))).toBe('Network down');
    expect(refusalOf('nope')).toBe('The move did not go through.');
  });
});
