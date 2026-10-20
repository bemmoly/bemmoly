import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { guideline, reportableSprints, runningTotals } from './model.ts';
import ReportsScreen from './reports-screen.tsx';

/*
 * The Reports view against a mock backend: one active sprint with a report, one closed sprint
 * in the velocity, and three days of flow.
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

const sprint = (n: number, name: string, state: string, startedAt: string | null) => ({
  id: id(n),
  projectId: PROJECT.id,
  name,
  goal: null,
  startsAt: startedAt,
  endsAt: null,
  state,
  capacityPoints: null,
  completedSnapshot: null,
  startedAt,
  closedAt: state === 'closed' ? AT : null,
  createdAt: AT,
  updatedAt: AT,
});

const ACTIVE = sprint(1, 'Sprint 15', 'active', '2026-10-10T09:00:00.000Z');
const CLOSED = sprint(2, 'Sprint 14', 'closed', '2026-09-26T09:00:00.000Z');
const FUTURE = sprint(3, 'Sprint 16', 'future', null);

const issue = (n: number, title: string, estimate: number | null) => ({
  issueId: id(100 + n),
  key: `PLT-${n}`,
  title,
  estimate,
});

const REPORT = {
  sprint: ACTIVE,
  burndown: [
    { date: '2026-10-10', remainingPoints: 8 },
    { date: '2026-10-11', remainingPoints: 5 },
  ],
  burnup: [
    { date: '2026-10-10', scopePoints: 8, completedPoints: 0 },
    { date: '2026-10-11', scopePoints: 10, completedPoints: 5 },
  ],
  velocity: [
    {
      ...{ sprintId: CLOSED.id, name: 'Sprint 14', committedPoints: 12, completedPoints: 9 },
      ...{ committedIssues: 4, completedIssues: 3, scopeIssues: 5, scopePoints: 15 },
      ...{ carriedOverIssues: 4, carriedOverPoints: 9, addedIssues: 1, addedPoints: 3 },
    },
  ],
  scope: {
    completed: [issue(1, 'Session store migration', 5)],
    notCompleted: [issue(2, 'Billing v2', 3), issue(3, 'Rate limits', 2)],
    added: [issue(3, 'Rate limits', 2)],
    removed: [],
    carriedOver: [issue(2, 'Billing v2', 3)],
  },
  changes: {
    ...{ scopeIssues: 3, scopePoints: 10, carriedOverIssues: 1, carriedOverPoints: 3 },
    ...{ addedIssues: 1, addedPoints: 2 },
  },
};

const FLOW = {
  projectId: PROJECT.id,
  days: [
    { date: '2026-10-10', todo: 3, inProgress: 1, done: 0, created: 2, resolved: 0 },
    { date: '2026-10-11', todo: 2, inProgress: 1, done: 1, created: 0, resolved: 1 },
    { date: '2026-10-12', todo: 2, inProgress: 0, done: 2, created: 0, resolved: 1 },
  ],
};

const CONTROL = {
  from: '2026-09-14',
  to: '2026-10-12',
  points: [
    {
      issueId: id(101),
      key: 'PLT-1',
      title: 'Session store migration',
      completedAt: '2026-10-11T10:00:00.000Z',
      cycleDays: 2,
    },
  ],
  meanDays: 2,
  medianDays: 2,
};

const TIME_IN_STATUS = {
  from: '2026-09-14',
  to: '2026-10-12',
  statuses: [
    { statusId: id(201), name: 'Backlog', category: 'todo', averageDays: 6.5, issues: 3 },
    { statusId: id(202), name: 'In progress', category: 'in_progress', averageDays: 2, issues: 1 },
  ],
};

const EPIC = { id: id(301), label: 'PLT-9 Checkout', done: false };
const VERSION = { id: id(302), label: '1.0', done: false };
const scopeReport = (kind: string) => ({
  kind,
  targets: kind === 'epic' ? [EPIC] : [VERSION],
  target: kind === 'epic' ? EPIC : VERSION,
  weeks: [
    { date: '2026-10-05', scopePoints: 8, completedPoints: 0, scopeIssues: 2, completedIssues: 0 },
    { date: '2026-10-12', scopePoints: 8, completedPoints: 3, scopeIssues: 2, completedIssues: 1 },
  ],
});

let flowQueries: string[] = [];
let scopeQueries: string[] = [];
let sprints: unknown[] = [];
let reportFor: string[] = [];

const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [PROJECT], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/:id/sprints', () =>
    HttpResponse.json({ items: sprints, nextCursor: null }),
  ),
  http.get('*/api/v1/work/sprints/:id/report', ({ params }) => {
    reportFor.push(String(params.id));
    return HttpResponse.json({ ...REPORT, sprint: params.id === CLOSED.id ? CLOSED : ACTIVE });
  }),
  http.get('*/api/v1/work/projects/PLT/reports/flow', ({ request }) => {
    flowQueries.push(new URL(request.url).search);
    return HttpResponse.json(FLOW);
  }),
  http.get('*/api/v1/work/projects/PLT/reports/control', () => HttpResponse.json(CONTROL)),
  http.get('*/api/v1/work/projects/PLT/reports/time-in-status', () =>
    HttpResponse.json(TIME_IN_STATUS),
  ),
  http.get('*/api/v1/work/projects/PLT/reports/scope', ({ request }) => {
    const url = new URL(request.url);
    scopeQueries.push(url.search);
    return HttpResponse.json(scopeReport(url.searchParams.get('kind') ?? 'epic'));
  }),
  http.get('*/api/v1/work/projects/PLT/reports/stats', () =>
    HttpResponse.json({
      by: 'status',
      by2: null,
      rows: [{ id: id(201), label: 'Backlog', count: 2 }],
      total: 2,
    }),
  ),
  http.get('*/api/v1/work/projects/PLT/reports/time-tracking', () =>
    HttpResponse.json({
      from: '2026-09-14',
      to: '2026-10-12',
      totalMinutes: 0,
      weeks: [],
      people: [],
      issues: [],
    }),
  ),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  flowQueries = [];
  scopeQueries = [];
  reportFor = [];
  sprints = [CLOSED, ACTIVE, FUTURE];
  window.history.replaceState(null, '', '/work/reports/PLT');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderReports() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ReportsScreen projectKey="PLT" rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Reports screen', () => {
  it('draws all five reports for the active sprint and the last 30 days', async () => {
    renderReports();
    expect(screen.getByRole('status', { name: 'Loading the reports' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Sprint 15 burndown' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sprint 15 burnup' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Velocity' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Cumulative flow' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Created vs resolved' })).toBeTruthy();
    expect(reportFor).toEqual([ACTIVE.id]);
    expect(flowQueries).toEqual(['?days=30']);

    const added = screen.getByRole('region', { name: /Added after the start/ });
    expect(within(added).getByRole('button', { name: /PLT-3 Rate limits/ })).toBeTruthy();
    expect(screen.getByText('No issues left the sprint.')).toBeTruthy();
    const carried = screen.getByRole('region', { name: /Carried over/ });
    expect(within(carried).getByRole('button', { name: /PLT-2 Billing v2/ })).toBeTruthy();
    expect(screen.getByText('4 issues, 9 pts')).toBeTruthy();
    expect(screen.getByText('33% of issues, 20% of points')).toBeTruthy();
    expect(screen.getByText('20% of issues, 20% of pts')).toBeTruthy();
    expect(screen.getByText('2 created, 2 resolved')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Time tracking' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
    expect(await screen.findByText('No time was logged in this range.')).toBeTruthy();
  });

  it('draws the control chart, time in status and the epic burnup, and switches to versions', async () => {
    renderReports();
    expect(await screen.findByRole('img', { name: 'Control chart' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Time in status' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'PLT-9 Checkout burnup' })).toBeTruthy();
    expect(screen.getByText('Mean 2 days', { selector: 'span.text-12' })).toBeTruthy();
    expect(scopeQueries[0]).toBe('?kind=epic&weeks=12');

    fireEvent.click(screen.getByRole('radio', { name: 'Versions' }));
    expect(window.location.search).toBe('?scope=version');
    expect(await screen.findByRole('img', { name: '1.0 burnup' })).toBeTruthy();
    expect(scopeQueries).toContain('?kind=version&weeks=12');
  });

  it('keeps the range in the address', async () => {
    renderReports();
    fireEvent.click(await screen.findByRole('radio', { name: '90 days' }));
    expect(window.location.search).toBe('?range=90');
    await screen.findByRole('img', { name: 'Cumulative flow' });
    expect(flowQueries).toContain('?days=90');
  });

  it('says no sprint has started and still draws the flow reports', async () => {
    sprints = [FUTURE];
    renderReports();
    expect(await screen.findByText('No sprint has started')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Cumulative flow' })).toBeTruthy();
    expect(reportFor).toEqual([]);
  });
});

describe('report model', () => {
  it('puts the active sprint first, then the latest started, and drops unstarted ones', () => {
    const order = reportableSprints([CLOSED, FUTURE, ACTIVE] as never).map((s) => s.name);
    expect(order).toEqual(['Sprint 15', 'Sprint 14']);
  });

  it('draws the guideline from the first day to zero and totals the flow', () => {
    expect(guideline(REPORT.burndown)).toEqual([8, 0]);
    expect(runningTotals(FLOW.days).at(-1)).toEqual({
      date: '2026-10-12',
      created: 2,
      resolved: 2,
    });
  });
});
