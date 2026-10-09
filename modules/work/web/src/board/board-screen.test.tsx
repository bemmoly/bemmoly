import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { STATUS, testView } from '../hooks/board-fixtures.ts';
import { useBoardFilterStore } from '../hooks/board-filters.ts';
import BoardScreen from './board-screen.tsx';

const PROJECT = {
  id: '018f0000-0000-7000-8000-000000000050',
  key: 'PLT',
  name: 'Platform Core',
  description: null,
  teamId: null,
  method: 'kanban',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const transition = (to: string, available: boolean, blockedBy: string[] = []) => ({
  id: '018f0000-0000-7000-8000-000000000999',
  name: 'Move',
  toStatusId: to,
  toStatusName: 'Next',
  toStatusCategory: 'in_progress',
  available,
  blockedBy,
});

let patches: string[] = [];
const refusal = (status: number) =>
  HttpResponse.json({ code: 'not_found', message: 'Not here', requestId: 't' }, { status });

const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [PROJECT], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/:id/boards', () =>
    HttpResponse.json({ items: [testView().board] }),
  ),
  http.get('*/api/v1/work/boards/:id/view', () => HttpResponse.json(testView())),
  http.get('*/api/v1/work/boards/:id/metrics', () => refusal(404)),
  http.get('*/api/v1/work/projects/:id/:list', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/work/workflows', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => refusal(404)),
  http.get('*/api/v1/work/filters', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/teams', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/work/issues/:key/transitions', ({ params }) =>
    HttpResponse.json({
      items:
        params['key'] === 'PLT-13'
          ? [transition(STATUS.done, false, ['Set a reviewer first.'])]
          : [transition(STATUS.doing, true)],
    }),
  ),
  http.patch('*/api/v1/work/issues/:key', ({ params }) => {
    patches.push(String(params['key']));
    return refusal(404);
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  patches = [];
  useBoardFilterStore.getState().reset();
  useBoardDragStore.getState().finish();
});
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

function renderScreen(projectKey: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BoardScreen projectKey={projectKey} rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function renderBoard() {
  renderScreen('PLT');
  await screen.findByRole('heading', { name: 'Platform Core board' });
}

const cardEl = (key: string) => {
  const el = document.querySelector<HTMLElement>(`[aria-label^="${key} "]`);
  if (!el) throw new Error(`no card ${key}`);
  return el;
};

const key = (el: HTMLElement, name: string) => act(() => void fireEvent.keyDown(el, { key: name }));

describe('Board screen', () => {
  it('lays the view out in columns and lanes with WIP counts', async () => {
    await renderBoard();
    expect(screen.getByRole('group', { name: 'To do, Auth service' })).toBeTruthy();
    expect(screen.getByLabelText('2 of 2 allowed')).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Done, Auth service' })).getByText('Issue 14'),
    ).toBeTruthy();
  });

  it('carries a card with the keyboard and drops it into the next column', async () => {
    await renderBoard();
    const card = cardEl('PLT-10');
    card.focus();
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts).not.toBeNull());
    key(card, 'ArrowRight');
    expect(useBoardDragStore.getState().target).toMatchObject({ columnId: 'doing' });
    key(card, ' ');
    await waitFor(() => expect(patches).toEqual(['PLT-10']));
  });

  it('keeps the focus on a card dropped with the keyboard in its new column', async () => {
    server.use(http.patch('*/api/v1/work/issues/:key', () => new Promise<never>(() => undefined)));
    await renderBoard();
    const card = cardEl('PLT-10');
    card.focus();
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts).not.toBeNull());
    key(card, 'ArrowRight');
    key(card, ' ');
    const doing = screen.getByRole('group', { name: 'In progress, Auth service' });
    await waitFor(() => expect(within(doing).getByText('Issue 10')).toBeTruthy());
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('PLT-10 Issue 10'),
    );
    expect(doing.contains(document.activeElement)).toBe(true);
  });

  it('says a linked project is not one the person can see', async () => {
    renderScreen('sec');
    expect(await screen.findByText('There is no project SEC you can see.')).toBeTruthy();
  });

  it('puts a carried card back on Escape', async () => {
    await renderBoard();
    const card = cardEl('PLT-11');
    key(card, ' ');
    key(card, 'ArrowRight');
    key(card, 'Escape');
    expect(useBoardDragStore.getState().carrying).toBeNull();
    expect(screen.getByText('PLT-11 put back.')).toBeTruthy();
    expect(patches).toEqual([]);
  });

  it('shows why the workflow refuses a column and sends nothing', async () => {
    await renderBoard();
    const card = cardEl('PLT-13');
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts?.['done']).toBeTruthy());
    key(card, 'ArrowRight');
    expect(await screen.findByText('Set a reviewer first.')).toBeTruthy();
    key(card, ' ');
    expect(await screen.findByText('PLT-13 cannot move to Done')).toBeTruthy();
    expect(patches).toEqual([]);
  });

  it('opens the issue in the slide-over on Enter and closes it', async () => {
    await renderBoard();
    key(cardEl('PLT-12'), 'Enter');
    const panel = await screen.findByRole('complementary', { name: 'PLT-12 details' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    // The panel plays its exit before it unmounts.
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'PLT-12 details' })).toBeNull(),
    );
  });

  it('fades the cards a quick filter leaves out', async () => {
    await renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Blocked' }));
    await waitFor(() => expect(document.querySelectorAll('.opacity-28')).toHaveLength(6));
  });
});
