import { WORK_REALTIME_KINDS, type BoardView } from '@bemmoly/module-work/shared';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { workKeys } from '../shared/index.ts';
import { BOARD_ID, card, STATUS, testView } from './board-fixtures.ts';
import { createBoardLive } from './board-live.ts';

/*
 * The board following realtime events card by card: a burst gathered into one read of the
 * named cards, a patch in place of a refetch, and a full read only when the event or the
 * answer calls for one.
 */

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const VIEW = workKeys.boardView(BOARD_ID, {});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const view = testView();
  const fullReads: string[] = [];
  client.setQueryData(VIEW, view);
  // A screen shows the view, so the patcher keeps it current rather than marking it stale.
  const observer = new QueryObserver(client, {
    queryKey: VIEW,
    queryFn: async () => {
      fullReads.push('view');
      return view;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  const live = createBoardLive(client, view.board.projectId!, 5);
  return { client, view, live, fullReads, stop: () => (unsubscribe(), live.dispose()) };
}

describe('createBoardLive', () => {
  it('gathers a burst of issue events into one read of those cards and patches them in', async () => {
    const asked: string[] = [];
    const { client, view, live, fullReads, stop } = setup();
    const [first, second] = [view.cards[0]!, view.cards[1]!];
    server.use(
      http.get('*/api/v1/work/boards/:id/view', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('issueIds') ?? '');
        const moved = { ...first, columnId: 'doing', statusId: STATUS.doing };
        return HttpResponse.json({ ...view, cards: [moved, second] });
      }),
    );
    live.take(WORK_REALTIME_KINDS.issue, [first.issueId]);
    live.take(WORK_REALTIME_KINDS.board, [first.issueId]);
    live.take(WORK_REALTIME_KINDS.issue, [second.issueId]);
    await waitFor(() =>
      expect(client.getQueryData<BoardView>(VIEW)?.cards[0]?.columnId).toBe('doing'),
    );
    expect(asked).toEqual([`${first.issueId},${second.issueId}`]);
    expect(fullReads).toEqual([]);
    stop();
  });

  it('adds a card the server now has on the board', async () => {
    const { client, view, live, stop } = setup();
    const created = card(30, { rank: 'a' });
    server.use(
      http.get('*/api/v1/work/boards/:id/view', () =>
        HttpResponse.json({ ...view, cards: [created] }),
      ),
    );
    live.take(WORK_REALTIME_KINDS.issue, [created.issueId]);
    await waitFor(() =>
      expect(client.getQueryData<BoardView>(VIEW)?.cards.map((entry) => entry.key)).toContain(
        'PLT-30',
      ),
    );
    stop();
  });

  it('reads the board again when its config changes', async () => {
    const { client, view, live, fullReads, stop } = setup();
    client.setQueryData(workKeys.boards(view.board.projectId!), [view.board]);
    live.take(WORK_REALTIME_KINDS.board, [view.board.id]);
    await waitFor(() => expect(fullReads).toEqual(['view']));
    expect(client.getQueryState(workKeys.boards(view.board.projectId!))?.isInvalidated).toBe(true);
    stop();
  });

  it('reads the board again when the patch cannot be read', async () => {
    const { live, view, fullReads, stop } = setup();
    server.use(
      http.get('*/api/v1/work/boards/:id/view', () =>
        HttpResponse.json({ message: 'down' }, { status: 500 }),
      ),
    );
    live.take(WORK_REALTIME_KINDS.issue, [view.cards[0]!.issueId]);
    await waitFor(() => expect(fullReads).toEqual(['view']));
    stop();
  });

  it('leaves the board alone while a card move is in flight', async () => {
    const asked: string[] = [];
    const { client, view, live, fullReads, stop } = setup();
    server.use(
      http.get('*/api/v1/work/boards/:id/view', () => {
        asked.push('patch');
        return HttpResponse.json(view);
      }),
    );
    void client
      .getMutationCache()
      .build(client, {
        mutationKey: workKeys.boardMove(BOARD_ID),
        mutationFn: () => new Promise<void>(() => undefined),
      })
      .execute(undefined);
    live.take(WORK_REALTIME_KINDS.issue, [view.cards[0]!.issueId]);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(asked).toEqual([]);
    expect(fullReads).toEqual([]);
    stop();
  });

  it('ignores events that are not about issues or boards', async () => {
    const { live, fullReads, stop } = setup();
    live.take(WORK_REALTIME_KINDS.sprint, ['018f0000-0000-7000-8000-0000000000aa']);
    live.take(WORK_REALTIME_KINDS.members, ['018f0000-0000-7000-8000-0000000000ab']);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(fullReads).toEqual([]);
    stop();
  });
});
