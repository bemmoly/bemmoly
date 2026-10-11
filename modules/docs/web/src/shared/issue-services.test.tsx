import {
  createEntityRendererRegistry,
  EntityRenderersProvider,
  type EntityRenderer,
} from '@bemmoly/core-web';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIssueServices } from './issue-services.tsx';

const issue: EntityRenderer = {
  kind: 'issue',
  Chip: ({ entityKey }) => <span>chip {entityKey}</span>,
  Table: ({ query, title }) => (
    <span>
      table {title}: {query}
    </span>
  ),
  search: async (query) => [{ id: 'PLT-1', label: 'PLT-1', description: query }],
};

const registry = createEntityRendererRegistry({ work: async () => ({ default: [issue] }) });
const withModules =
  (moduleIds: string[]) =>
  ({ children }: { children: ReactNode }) => (
    <EntityRenderersProvider registry={registry} moduleIds={moduleIds}>
      {children}
    </EntityRenderersProvider>
  );

describe('useIssueServices', () => {
  afterEach(cleanup);

  it('lends Work’s chip, table and search once Work is on', async () => {
    const { result } = renderHook(() => useIssueServices(), {
      wrapper: withModules(['docs', 'work']),
    });
    await waitFor(() => expect(result.current.renderIssue).toBeDefined());
    render(
      <>
        {result.current.renderIssue?.('PLT-1')}
        {result.current.renderIssueTable?.({ query: 'status = open', title: 'Open' })}
      </>,
    );
    expect(screen.getByText('chip PLT-1')).toBeTruthy();
    expect(screen.getByText('table Open: status = open')).toBeTruthy();
    const signal = new AbortController().signal;
    expect(await result.current.searchIssues?.('  cache ', signal)).toEqual([
      { id: 'PLT-1', label: 'PLT-1', description: 'cache' },
    ]);
    expect(await result.current.searchIssues?.('   ', signal)).toEqual([]);
  });

  it('lends nothing with Work off, so the editor keeps its placeholders', () => {
    const off = renderHook(() => useIssueServices(), { wrapper: withModules(['docs']) });
    expect(off.result.current).toEqual({});
    const bare = renderHook(() => useIssueServices());
    expect(bare.result.current).toEqual({});
  });
});
