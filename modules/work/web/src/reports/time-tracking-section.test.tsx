import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TimeTrackingSection } from './time-tracking-section.tsx';

const id = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const REPORT = {
  from: '2026-09-17',
  to: '2026-10-16',
  totalMinutes: 270,
  weeks: [
    { date: '2026-09-17', minutes: 90 },
    { date: '2026-09-24', minutes: 180 },
  ],
  people: [
    { userId: id(1), name: 'Ben', minutes: 180 },
    { userId: id(2), name: 'Ana', minutes: 90 },
  ],
  issues: [
    { issueId: id(10), key: 'PLT-1', title: 'Session store', estimate: 5, minutes: 200 },
    { issueId: id(11), key: 'PLT-2', title: 'Rate limits', estimate: null, minutes: 70 },
  ],
};

let body: typeof REPORT = REPORT;
let queries: string[] = [];
const server = setupServer(
  http.get('*/api/v1/work/projects/PLT/reports/time-tracking', ({ request }) => {
    queries.push(new URL(request.url).search);
    return HttpResponse.json(body);
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
afterEach(() => {
  cleanup();
  body = REPORT;
  queries = [];
});
afterAll(() => server.close());

function renderSection(onOpenIssue = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TimeTrackingSection projectKey="PLT" days={30} onOpenIssue={onOpenIssue} />
    </QueryClientProvider>,
  );
  return onOpenIssue;
}

describe('TimeTrackingSection', () => {
  it('shows the total, the weekly chart, the people and the top issues in hours', async () => {
    const onOpenIssue = renderSection();
    expect(await screen.findByText('4.5 h in total')).toBeTruthy();
    expect(queries).toEqual(['?days=30']);
    expect(screen.getByRole('heading', { name: 'Time tracking' })).toBeTruthy();
    expect(screen.getByText('Ben').nextElementSibling?.textContent).toBe('3.0 h');
    const issue = screen.getByRole('button', { name: /PLT-1/ });
    expect(issue.textContent).toContain('5 pts');
    expect(issue.textContent).toContain('3.3 h');
    expect(screen.getByRole('button', { name: /PLT-2/ }).textContent).toContain('Unestimated');
    fireEvent.click(issue);
    expect(onOpenIssue).toHaveBeenCalledWith('PLT-1');
  });

  it('says so when nothing was logged', async () => {
    body = { ...REPORT, totalMinutes: 0, weeks: [], people: [], issues: [] };
    renderSection();
    expect(await screen.findByText('No time was logged in this range.')).toBeTruthy();
  });
});
