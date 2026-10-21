import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IDS, roadmapView } from '../roadmap/fixtures.test-helper.ts';
import InitiativesScreen from './initiatives-screen.tsx';

/* Initiatives against a mock backend: the list, a new one, and one program's view. */

const PROGRAM = '018f0000-0000-7000-8000-00000000aa01';

const initiative = (over: Record<string, unknown> = {}) => ({
  id: PROGRAM,
  name: 'Self-serve launch',
  description: 'Sign up, pay and go mobile.',
  ownerId: null,
  startAt: '2026-09-01',
  targetAt: '2026-12-31',
  archivedAt: null,
  createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  epics: { total: 2, done: 0, hidden: 1 },
  progress: { total: 10, done: 4, inProgress: 2, points: 0, pointsDone: 0 },
  projectIds: [IDS.plt, IDS.mob],
  canManage: true,
  ...over,
});

const created: unknown[] = [];
const unlinked: string[] = [];
let roadmapQueries: string[] = [];

const server = setupServer(
  http.get('*/api/v1/work/initiatives', () =>
    HttpResponse.json({ items: [initiative()], nextCursor: null }),
  ),
  http.post('*/api/v1/work/initiatives', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    created.push(body);
    return HttpResponse.json(initiative({ ...body, id: IDS.billing }), { status: 201 });
  }),
  http.get('*/api/v1/work/initiatives/:id', () => HttpResponse.json(initiative())),
  http.delete('*/api/v1/work/initiatives/:id/epics/:epicId', ({ params }) => {
    unlinked.push(String(params['epicId']));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/v1/work/projects', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({ capabilities: [] })),
  http.get('*/api/v1/work/roadmap', ({ request }) => {
    roadmapQueries.push(new URL(request.url).search);
    const view = roadmapView();
    return HttpResponse.json({
      ...view,
      items: view.items.filter((item) => item.kind === 'epic'),
      dependencies: view.dependencies.map((d) => ({ ...d, conflict: true })),
    });
  }),
);

beforeAll(() => server.listen());
beforeEach(() => {
  created.length = 0;
  unlinked.length = 0;
  roadmapQueries = [];
  window.history.replaceState(null, '', '/work/initiatives');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderScreen(id?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <InitiativesScreen projectKey={id} rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Initiatives screen', () => {
  it('lists initiatives with their rolled-up progress', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Initiatives' });
    expect(within(table).getByText('Self-serve launch')).toBeTruthy();
    expect(within(table).getByText('0 of 2 done')).toBeTruthy();
    expect(within(table).getByText('40%')).toBeTruthy();
  });

  it('creates an initiative and refuses a start after its target', async () => {
    renderScreen();
    await screen.findByRole('table', { name: 'Initiatives' });
    fireEvent.click(screen.getAllByRole('button', { name: 'New initiative' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New initiative' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Mobile GA' } });
    fireEvent.change(within(dialog).getByLabelText('Start'), { target: { value: '2027-02-01' } });
    fireEvent.change(within(dialog).getByLabelText('Target'), { target: { value: '2027-01-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create initiative/ }));
    expect(await within(dialog).findByText('Start on or before the target date.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Start'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create initiative/ }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ name: 'Mobile GA', startAt: null, targetAt: '2027-01-01' });
  });

  it('shows one program: its rollup, its epics on the timeline, and unlinking', async () => {
    renderScreen(PROGRAM);
    const summary = await screen.findByRole('region', { name: 'Program summary' });
    expect(roadmapQueries).toEqual([`?initiative=${PROGRAM}`]);
    expect(within(summary).getByText('1 epic in projects you cannot open left out')).toBeTruthy();
    expect(within(summary).getByText('Date conflicts').parentElement?.textContent).toContain('1');
    expect(await screen.findByRole('list', { name: 'Roadmap' })).toBeTruthy();
    fireEvent.click(within(summary).getByRole('button', { name: /Show epics/ }));
    const epics = within(summary).getByRole('list', { name: 'Epics in this initiative' });
    fireEvent.click(within(epics).getAllByRole('button', { name: /^Unlink / })[0]!);
    await waitFor(() => expect(unlinked).toHaveLength(1));
  });
});
