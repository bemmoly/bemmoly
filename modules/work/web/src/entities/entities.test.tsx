import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Work's renderers for other modules: a chip and row that read the issue
 * through Work's API, the bare key for an issue the reader cannot open, and
 * the `#` search shaped as editor suggestions.
 */

const issue = {
  key: 'PLT-204',
  title: 'Session store migration to Postgres',
  type: { key: 'story', level: 'standard' },
  status: { name: 'In review', category: 'in_progress' },
  priority: 'highest',
  assignee: { id: 'u1', name: 'Aisha K.', email: 'a@example.org' },
  parent: null,
  sprint: { id: 's1', name: 'Sprint 14', state: 'active' },
};

vi.mock('../shared/api.ts', () => ({
  api: {
    work: {
      issues: {
        get: async (key: string) => {
          if (key === issue.key) return issue;
          throw new Error('The issue was not found');
        },
        suggest: async () => [{ id: 'i', key: 'PLT-204', title: issue.title }],
      },
    },
  },
}));

const { default: renderers } = await import('../entities.tsx');
const [renderer] = renderers;

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('work entity renderers', () => {
  afterEach(cleanup);

  it('lends an issue chip, card, embed, table and search', () => {
    expect(renderer).toMatchObject({ kind: 'issue' });
    expect(
      renderer?.Chip && renderer.Card && renderer.Embed && renderer.Table && renderer.search,
    ).toBeTruthy();
  });

  it('draws the card embed with status, priority and assignee', async () => {
    const Embed = renderer!.Embed!;
    wrap(<Embed entityKey="PLT-204" />);
    expect(await screen.findByText('In review')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open PLT-204' }).getAttribute('href')).toBe(
      '/work/issue/PLT-204',
    );
  });

  it('draws the chip live, and the bare key for an issue it cannot read', async () => {
    const Chip = renderer!.Chip!;
    const Card = renderer!.Card!;
    wrap(
      <>
        <Chip entityKey="PLT-204" />
        <Chip entityKey="PLT-999" />
        <Card entityKey="PLT-204" />
      </>,
    );
    expect(await screen.findAllByRole('img', { name: 'In review' })).toHaveLength(2);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/work/issue/PLT-204',
      '/work/issue/PLT-204',
    ]);
    expect(await screen.findByTitle(/An issue you can’t see/)).toBeTruthy();
    expect(screen.getAllByText('Session store migration to Postgres')).toHaveLength(2);
    expect(screen.queryByText('IN REVIEW')).toBeNull();
  });

  it('searches issues as editor suggestions named by key', async () => {
    const items = await renderer!.search!('plt', new AbortController().signal);
    expect(items).toEqual([
      { id: 'PLT-204', label: 'PLT-204', description: issue.title, href: '/work/issue/PLT-204' },
    ]);
  });
});
