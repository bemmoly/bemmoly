import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { STATUS, testView } from '../hooks/board-fixtures.ts';
import BoardScreen from './board-screen.tsx';

/*
 * The Board screen's tests share one mock backend: a Kanban project PLT with the fixture board,
 * transitions that refuse PLT-13 into Done, and issue updates that fail and are recorded.
 */

export const PROJECT = {
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

/** The issue keys each PATCH named, in order. */
export const sent: { patches: string[] } = { patches: [] };

export const refusal = (status: number) =>
  HttpResponse.json({ code: 'not_found', message: 'Not here', requestId: 't' }, { status });

export const projectsAnswer = (method: 'kanban' | 'scrum') =>
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [{ ...PROJECT, method }], nextCursor: null }),
  );

export const server = setupServer(
  projectsAnswer('kanban'),
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
    sent.patches.push(String(params['key']));
    return refusal(404);
  }),
);

/** happy-dom answers media queries from its viewport; the board docks its panel from 1200px. */
export const setWidth = (width: number) =>
  act(() =>
    (window as { happyDOM?: { setViewport(size: { width: number }): void } }).happyDOM?.setViewport(
      { width },
    ),
  );

export function renderScreen(projectKey: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BoardScreen projectKey={projectKey} rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

export async function renderBoard() {
  renderScreen('PLT');
  await screen.findByRole('heading', { name: 'Platform Core board' });
}

export const cardEl = (key: string) => {
  const el = document.querySelector<HTMLElement>(`[aria-label^="${key} "]`);
  if (!el) throw new Error(`no card ${key}`);
  return el;
};

export const key = (el: HTMLElement, name: string, init: KeyboardEventInit = {}) =>
  act(() => void fireEvent.keyDown(el, { key: name, ...init }));
