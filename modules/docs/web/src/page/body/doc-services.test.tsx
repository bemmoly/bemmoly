import {
  createEntityRendererRegistry,
  EntityRenderersProvider,
  type EntityRenderer,
} from '@bemmoly/core-web';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDocServices } from './use-doc-services.ts';

const search = vi.fn(async () => [{ id: 'PLT-204', label: 'PLT-204', description: 'Sessions' }]);
const issues: EntityRenderer = {
  kind: 'issue',
  Chip: ({ entityKey }) => <span>{entityKey}</span>,
  Table: ({ title }) => <table aria-label={title} />,
  search,
};

function withWork({ children }: { children: ReactNode }) {
  const registry = createEntityRendererRegistry({
    work: async () => ({ default: [issues] }),
  });
  return (
    <EntityRenderersProvider registry={registry} moduleIds={['work']}>
      {children}
    </EntityRenderersProvider>
  );
}

describe('the page’s editor services', () => {
  it('lends live issues from the module that owns them', async () => {
    const { result } = renderHook(() => useDocServices('page-1'), { wrapper: withWork });
    await waitFor(() => expect(result.current.renderIssue).toBeTypeOf('function'));
    expect(result.current.renderIssueTable).toBeTypeOf('function');
    const signal = new AbortController().signal;
    expect(await result.current.searchIssues?.('PLT', signal)).toEqual([
      { id: 'PLT-204', label: 'PLT-204', description: 'Sessions' },
    ]);
    expect(search).toHaveBeenCalledWith('PLT', signal);
    expect(result.current.pageHref?.('p-2')).toBe('/docs/p/p-2');
  });

  it('keeps placeholders without one, and # falls back to the kernel search', () => {
    const { result } = renderHook(() => useDocServices('page-1'));
    expect(result.current.renderIssue).toBeUndefined();
    expect(result.current.renderIssueTable).toBeUndefined();
    expect(result.current.searchIssues).toBeTypeOf('function');
    expect(result.current.uploadImage).toBeUndefined();
    expect(result.current.ai).toBeUndefined();
  });
});
