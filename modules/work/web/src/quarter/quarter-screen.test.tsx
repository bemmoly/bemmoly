import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { epicProgress, quarterChoices, quarterLabel, quarterTotals } from './model.ts';
import QuarterScreen from './quarter-screen.tsx';

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
const REPORT = {
  quarter: '2026-Q3',
  from: '2026-07-01',
  to: '2026-09-30',
  elapsed: 1,
  sprints: [
    {
      sprintId: id(1),
      name: 'Sprint 12',
      state: 'closed' as const,
      from: '2026-07-01',
      to: '2026-07-14',
      committedPoints: 10,
      completedPoints: 8,
    },
  ],
  epics: [
    {
      epicId: id(2),
      key: 'PLT-1',
      title: 'Billing v2',
      done: false,
      issues: 4,
      doneIssues: 1,
      points: 10,
      donePoints: 5,
      completedInQuarter: 1,
    },
  ],
  weeks: [
    { date: '2026-07-07', scopeIssues: 4, completedIssues: 0, scopePoints: 10, completedPoints: 0 },
    { date: '2026-09-30', scopeIssues: 4, completedIssues: 1, scopePoints: 10, completedPoints: 5 },
  ],
};

let asked: string[] = [];
const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [PROJECT], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/PLT/reports/quarter', ({ request }) => {
    asked.push(new URL(request.url).searchParams.get('quarter') ?? '');
    return HttpResponse.json(REPORT);
  }),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  asked = [];
  window.history.replaceState(null, '', '/work/quarter/PLT?quarter=2026-Q3');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Quarter screen', () => {
  it('draws the quarter in the address: figures, sprints and epics', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <QuarterScreen projectKey="PLT" rest={[]} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Q3 2026', level: 2 })).toBeTruthy();
    expect(asked).toEqual(['2026-Q3']);
    expect(screen.getByText('5 of 10 points')).toBeTruthy();
    expect(screen.getByText('Billing v2')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'PLT-1 progress' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PLT-1' })).toBeTruthy();
  });
});

describe('quarter model', () => {
  it('reads points when estimated and issues otherwise', () => {
    expect(quarterTotals(REPORT)).toMatchObject({ byPoints: true, done: 50, elapsed: 100 });
    const unestimated = {
      ...REPORT,
      weeks: [{ ...REPORT.weeks[1]!, scopePoints: 0, completedPoints: 0 }],
    };
    expect(quarterTotals(unestimated)).toMatchObject({ unit: 'issues', done: 25 });
    expect(epicProgress(REPORT.epics[0]!)).toBe(50);
  });

  it('labels quarters and offers a year back and the next one', () => {
    expect(quarterLabel('2026-Q4')).toBe('Q4 2026');
    expect(quarterChoices(Date.UTC(2026, 9, 21))).toEqual([
      '2027-Q1',
      '2026-Q4',
      '2026-Q3',
      '2026-Q2',
      '2026-Q1',
      '2025-Q4',
    ]);
  });
});
