import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StatsSection } from './stats-section.tsx';
import { tintStep } from './stats-table.tsx';

/* The Statistics section alone against a mock backend that answers one field or two. */

const ONE = {
  by: 'priority',
  by2: null,
  rows: [
    { id: 'high', label: 'High', count: 3 },
    { id: 'low', label: 'Low', count: 1 },
  ],
  total: 4,
};

const TWO = {
  by: 'assignee',
  by2: 'priority',
  rows: [
    { id: 'ana', label: 'Ana', count: 3 },
    { id: null, label: 'Unassigned', count: 1 },
  ],
  columns: [
    { id: 'high', label: 'High' },
    { id: 'low', label: 'Low' },
  ],
  cells: [
    { row: 'ana', column: 'high', count: 3 },
    { row: null, column: 'low', count: 1 },
  ],
  total: 4,
};

let queries: string[] = [];
const server = setupServer(
  http.get('*/api/v1/work/projects/PLT/reports/stats', ({ request }) => {
    const search = new URL(request.url).search;
    queries.push(search);
    return HttpResponse.json(search.includes('by2') ? TWO : ONE);
  }),
);

beforeAll(() => server.listen());
beforeEach(() => {
  queries = [];
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderAt(search: string) {
  window.history.replaceState(null, '', `/work/reports/PLT${search}`);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StatsSection projectKey="PLT" />
    </QueryClientProvider>,
  );
}

describe('Statistics section', () => {
  it('draws one field as bars and a list with each share', async () => {
    renderAt('?stat=priority');
    expect(await screen.findByRole('img', { name: 'Issues by priority' })).toBeTruthy();
    expect(queries).toEqual(['?by=priority']);
    const list = screen.getByRole('list', { name: 'Issues by priority' });
    const items = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toEqual(['High375%', 'Low125%']);
  });

  it('crosses two fields in a table with totals and printed counts', async () => {
    renderAt('?stat=assignee&stat2=priority');
    const table = await screen.findByRole('table', { name: 'Assignee by priority' });
    expect(queries).toEqual(['?by=assignee&by2=priority']);
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => row.textContent);
    expect(rows).toEqual(['HighLowTotal', 'Ana303', 'Unassigned011', 'Total314']);
    expect(within(table).getByRole('rowheader', { name: 'Unassigned' })).toBeTruthy();
  });

  it('tints by count on three steps and leaves zero untinted', () => {
    expect([0, 1, 2, 3].map((count) => tintStep(count, 3))).toEqual([0, 1, 2, 3]);
  });
});
