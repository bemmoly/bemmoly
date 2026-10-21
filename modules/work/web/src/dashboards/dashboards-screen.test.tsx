import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import DashboardsScreen from './dashboards-screen.tsx';
import { registerPinnedRenderer } from './registry.ts';

/*
 * The Dashboards screen against a stateful mock backend: a project with no sprints yet, its
 * flow, cycle and quarter reports, and dashboards kept in memory the way the server keeps them.
 */

const id = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const AT = '2026-10-01T00:00:00.000Z';
const PROJECT = {
  id: id(50),
  key: 'PLT',
  name: 'Platform Core',
  description: null,
  teamId: null,
  method: 'scrum',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
};
const FLOW = {
  projectId: PROJECT.id,
  days: [{ date: '2026-10-10', todo: 3, inProgress: 1, done: 0, created: 2, resolved: 0 }],
};
const QUARTER = {
  quarter: '2026-Q4',
  from: '2026-10-01',
  to: '2026-12-31',
  elapsed: 0.22,
  sprints: [],
  epics: [],
  weeks: [
    { date: '2026-10-07', scopeIssues: 4, completedIssues: 1, scopePoints: 10, completedPoints: 2 },
  ],
};

const widget = (n: number, type: string, config: object = {}, size = 'half') => ({
  id: id(300 + n),
  type,
  size,
  config,
});
const DEFAULTS = [
  widget(1, 'burndown'),
  widget(2, 'velocity'),
  widget(3, 'cumulative-flow', { days: 30 }),
  widget(4, 'quarter', {}, 'full'),
];

let dashboards: Record<string, unknown>[] = [];
let patches: { widgets?: { id: string; type: string; size: string }[] }[] = [];

const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [PROJECT], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/:id/sprints', () =>
    HttpResponse.json({ items: [], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/PLT/reports/flow', () => HttpResponse.json(FLOW)),
  http.get('*/api/v1/work/projects/PLT/reports/quarter', () => HttpResponse.json(QUARTER)),
  http.get('*/api/v1/work/dashboards', () =>
    HttpResponse.json({ items: dashboards, nextCursor: null }),
  ),
  http.post('*/api/v1/work/dashboards', async ({ request }) => {
    const body = (await request.json()) as { name: string };
    const created = {
      id: id(200 + dashboards.length),
      ownerId: id(1),
      projectId: PROJECT.id,
      name: body.name,
      widgets: DEFAULTS,
      createdAt: AT,
      updatedAt: AT,
    };
    dashboards.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch('*/api/v1/work/dashboards/:id', async ({ request, params }) => {
    const body = (await request.json()) as (typeof patches)[number];
    patches.push(body);
    const current = dashboards.find((item) => item['id'] === params.id) ?? {};
    Object.assign(current, body);
    return HttpResponse.json(current);
  }),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  dashboards = [];
  patches = [];
  window.history.replaceState(null, '', '/work/dashboards/PLT');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderDashboards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DashboardsScreen projectKey="PLT" rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const tiles = () =>
  within(screen.getByRole('list', { name: 'Dashboard reports' }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

describe('Dashboards screen', () => {
  it('creates a first dashboard with the default reports', async () => {
    renderDashboards();
    fireEvent.click(await screen.findByRole('button', { name: 'Create dashboard' }));
    expect(await screen.findByRole('list', { name: 'Dashboard reports' })).toBeTruthy();
    expect(tiles()).toEqual(['Burndown', 'Velocity', 'Cumulative flow', 'Quarter']);
    expect(await screen.findAllByText(/No sprint has started yet/)).toHaveLength(2);
    expect(await screen.findByText(/Q4 2026: 20% done/)).toBeTruthy();
  });

  it('moves a report with the arrow keys and writes the new order', async () => {
    dashboards = [
      { id: id(200), ownerId: id(1), projectId: PROJECT.id, name: 'Team', widgets: DEFAULTS },
    ].map((item) => ({ ...item, createdAt: AT, updatedAt: AT }));
    renderDashboards();
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Move Burndown' }), {
      key: 'ArrowDown',
    });
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.widgets?.map((item) => item.type)).toEqual([
      'velocity',
      'burndown',
      'cumulative-flow',
      'quarter',
    ]);
    expect(tiles()).toEqual(['Velocity', 'Burndown', 'Cumulative flow', 'Quarter']);
  });

  it('adds, resizes and removes reports from their menus', async () => {
    dashboards = [
      {
        id: id(200),
        ownerId: id(1),
        projectId: PROJECT.id,
        name: 'Team',
        widgets: [DEFAULTS[2]],
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    renderDashboards();
    fireEvent.click(await screen.findByRole('button', { name: 'Add report' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Created vs resolved/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.widgets?.map((item) => item.type)).toEqual([
      'cumulative-flow',
      'created-resolved',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Cumulative flow actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Make full width' }));
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]?.widgets?.[0]?.size).toBe('full');

    fireEvent.click(screen.getByRole('button', { name: 'Cumulative flow actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from dashboard' }));
    await waitFor(() => expect(patches).toHaveLength(3));
    expect(patches[2]?.widgets?.map((item) => item.type)).toEqual(['created-resolved']);
  });

  it('draws a pinned report through its registered renderer, and says so without one', async () => {
    registerPinnedRenderer('test.note', ({ spec }) => <p>Rendered {String(spec.params['n'])}</p>);
    const pinned = (n: number, kind: string, title: string) =>
      widget(n, 'pinned', {
        spec: { version: 1, title, kind, source: 'assistant', params: { n } },
      });
    dashboards = [
      {
        id: id(200),
        ownerId: id(1),
        projectId: PROJECT.id,
        name: 'Pins',
        widgets: [pinned(7, 'test.note', 'Known'), pinned(8, 'later.kind', 'Unknown')],
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    renderDashboards();
    expect(await screen.findByText('Rendered 7')).toBeTruthy();
    expect(screen.getByText(/This report cannot be drawn here yet/)).toBeTruthy();
  });
});
