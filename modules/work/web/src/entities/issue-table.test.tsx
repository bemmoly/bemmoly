import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssueTable } from './issue-table.tsx';

/*
 * A document's live issue table: the whole table is one request to Work's summaries
 * endpoint, and every row still prints its key, title and status without asking again.
 */

const STATUSES = [
  { name: 'To do', category: 'todo' },
  { name: 'In review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
] as const;

const summaries = Array.from({ length: 6 }, (_, index) => ({
  id: `0192f3a0-0000-7000-8000-00000000000${index}`,
  key: `PLT-${index + 1}`,
  title: `Row number ${index + 1}`,
  type: {
    id: '0192f3a0-0000-7000-8000-0000000000aa',
    key: 'task',
    name: 'Task',
    level: 'standard',
    icon: null,
  },
  status: { id: `0192f3a0-0000-7000-8000-0000000000b${index}`, ...STATUSES[index % 3]! },
  assignee: index === 0 ? { id: '0192f3a0-0000-7000-8000-0000000000cc', name: 'Aisha K.' } : null,
}));

function stubFetch(body: unknown) {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function draw(query: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IssueTable query={query} title="Open work" />
    </QueryClientProvider>,
  );
}

describe('IssueTable', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('draws every row from one request', async () => {
    const fetch = stubFetch({ items: summaries, nextCursor: null });
    draw('status != Done ORDER BY created ASC');

    expect(await screen.findByText('Row number 6')).toBeTruthy();
    for (const issue of summaries) {
      expect(screen.getByText(issue.key)).toBeTruthy();
      expect(screen.getByText(issue.title)).toBeTruthy();
      expect(screen.getByRole('link', { name: new RegExp(issue.key) }).getAttribute('href')).toBe(
        `/work/issue/${issue.key}`,
      );
    }
    expect(screen.getAllByRole('img', { name: 'In review' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(2);

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = String(fetch.mock.calls[0]?.[0]);
    expect(url.startsWith('/api/v1/work/issues/summaries?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('lql')).toBe('status != Done ORDER BY created ASC');
    expect(params.get('limit')).toBe('10');
  });

  it('says when there are more rows, and when there are none', async () => {
    stubFetch({ items: summaries.slice(0, 1), nextCursor: summaries[0]!.id });
    draw('assignee = me');
    expect(await screen.findByText('Showing the first 10 issues.')).toBeTruthy();
    cleanup();

    stubFetch({ items: [], nextCursor: null });
    draw('assignee = nobody');
    expect(await screen.findByText('No issues match this query.')).toBeTruthy();
  });
});
