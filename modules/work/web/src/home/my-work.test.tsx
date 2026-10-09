import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyIssue, MyIssues } from '../../../shared/index.ts';
import MyWorkSection from '../home.tsx';

const issue = (key: string, title: string, patch: Partial<MyIssue> = {}): MyIssue => ({
  id: `0199c0de-0000-7000-8000-0000000000${key.slice(-2).padStart(2, '0')}`,
  key,
  title,
  priority: 'high',
  dueAt: '2026-10-14',
  updatedAt: '2026-10-09T09:00:00.000Z',
  status: {
    id: '0199c0de-0000-7000-8000-000000000101',
    name: 'In progress',
    category: 'in_progress',
    color: null,
  },
  type: {
    id: '0199c0de-0000-7000-8000-000000000201',
    key: 'story',
    name: 'Story',
    icon: null,
    color: null,
  },
  ...patch,
});

const lists: MyIssues = {
  assigned: { items: [issue('PLT-12', 'Stripe webhook idempotency')], total: 1 },
  reported: { items: [], total: 0 },
  watching: { items: [issue('PLT-31', 'Audit log export', { dueAt: null })], total: 3 },
};

function renderSection() {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(lists), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MyWorkSection
        manifest={{
          id: 'work',
          version: '0.2.0',
          navigation: [{ id: 'work.board', label: 'Board', path: '/work/board', placement: 'top' }],
        }}
      />
    </QueryClientProvider>,
  );
  return fetch;
}

describe('my work on Home', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lists the assigned issues with key, title, status and a link, and counts each tab', async () => {
    const fetch = renderSection();
    const row = await screen.findByRole('link', { name: /Stripe webhook idempotency/ });
    expect(row.getAttribute('href')).toBe('/work/issues/PLT-12');
    expect(row.textContent).toContain('PLT-12');
    expect(row.textContent).toContain('In progress');
    expect(row.textContent).toContain('Due Oct 14');
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/work/my-issues?limit=6');
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Assigned to me1', 'Reported by me0', 'Watching3']);
  });

  it('switches tabs and says what an empty one means', async () => {
    renderSection();
    await screen.findByText('Stripe webhook idempotency');
    fireEvent.click(screen.getByRole('tab', { name: /Reported by me/ }));
    expect(screen.getByText('You have not reported an issue yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Watching/ }));
    expect(screen.getByText('Audit log export')).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });
});
