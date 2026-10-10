import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyIssue, MyIssues } from '../../../shared/index.ts';
import MyWorkSection from '../home.tsx';
import { groupByStatus } from './use-my-work.ts';

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

const todo = {
  id: '0199c0de-0000-7000-8000-000000000102',
  name: 'To do',
  category: 'todo' as const,
  color: null,
};

const lists: MyIssues = {
  assigned: {
    items: [
      issue('PLT-12', 'Stripe webhook idempotency'),
      issue('PLT-14', 'Dunning emails', { status: todo }),
    ],
    total: 2,
  },
  reported: { items: [], total: 0 },
  watching: { items: [issue('PLT-31', 'Audit log export', { dueAt: null })], total: 3 },
};

const mention = {
  id: '0199c0de-0000-7000-8000-000000000301',
  ids: ['0199c0de-0000-7000-8000-000000000301'],
  kind: 'mention',
  verb: 'mentioned you in',
  summary: 'Priya N. mentioned you in PLT-218',
  actors: [{ id: null, name: 'Priya N.' }],
  actorCount: 1,
  // As Work's server sends it: the issue's id, its key as the label.
  target: { kind: 'issue', id: 'x', label: 'PLT-218', url: '/work/issue/PLT-218' },
  body: 'can you confirm the deploy hook?',
  read: false,
  done: false,
  snoozedUntil: null,
  createdAt: '2026-10-09T09:00:00.000Z',
};

function renderSection() {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const body = String(input).includes('/notifications')
      ? { items: [mention], nextCursor: null, unreadCount: 1 }
      : lists;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MyWorkSection manifest={{ id: 'work', version: '0.2.0', navigation: [] }} />
    </QueryClientProvider>,
  );
  return fetch;
}

describe('My issues on Home', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('groups the assigned issues by status, started first, and counts each tab', async () => {
    const fetch = renderSection();
    const row = await screen.findByRole('link', { name: /Stripe webhook idempotency/ });
    expect(row.getAttribute('href')).toBe('/work/issue/PLT-12');
    expect(row.textContent).toContain('Due Oct 14');
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/work/my-issues?limit=6');
    const groups = screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['In progress', 'To do']);
    const tabs = screen.getAllByRole('radio').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Assigned · 2', 'Created · 0', 'Watching · 3', 'Mentions']);
    expect(JSON.parse(sessionStorage.getItem('bemmoly.work.issue-list') ?? 'null')).toEqual({
      label: 'My issues · Assigned',
      keys: ['PLT-12', 'PLT-14'],
    });
  });

  it('says what an empty tab means and lists mentions from the inbox', async () => {
    renderSection();
    await screen.findByText('Stripe webhook idempotency');
    fireEvent.click(screen.getByRole('radio', { name: /Created/ }));
    expect(screen.getByText('You have not created an issue yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Mentions/ }));
    const link = await screen.findByRole('link', { name: /Priya N\./ });
    expect(link.getAttribute('href')).toBe('/work/issue/PLT-218');
  });

  it('orders status groups in progress, to do, then done', () => {
    const done = { ...todo, name: 'Done', category: 'done' as const };
    const groups = groupByStatus([
      issue('PLT-1', 'a', { status: done }),
      issue('PLT-2', 'b', { status: todo }),
      issue('PLT-3', 'c'),
    ]);
    expect(groups.map((group) => group.name)).toEqual(['In progress', 'To do', 'Done']);
  });
});
