import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, act, renderHook, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useSavedFilters } from './saved-filters.ts';
import { filtersBackend, PLATFORM, PROJECT, useTestOrigin } from './saved-filters-backend.ts';

let backend = filtersBackend();
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  useTestOrigin();
  backend = filtersBackend();
  server.resetHandlers(...backend.handlers);
});
afterEach(cleanup);
afterAll(() => server.close());

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSavedFilters(PROJECT), { wrapper });
}

describe('useSavedFilters', () => {
  it("splits my filters from my teams' and offers only my teams to share with", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.mine).toHaveLength(1));
    expect(result.current.mine.map((filter) => filter.name)).toEqual(['My open work']);
    expect(result.current.shared.map((filter) => filter.name)).toEqual(['Waiting for review']);
    await waitFor(() =>
      expect(result.current.myTeams).toEqual([{ id: PLATFORM, name: 'Platform' }]),
    );
    expect(result.current.audience(result.current.mine[0]!)).toBe('Only you');
    expect(result.current.audience(result.current.shared[0]!)).toBe('Shared with Platform');
  });

  it('saves the applied query for the project, shared with one team', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.mine).toHaveLength(1));
    await act(() =>
      result.current.save.mutateAsync({
        name: '  Review queue ',
        query: 'status = "Code review"',
        teamId: PLATFORM,
      }),
    );
    expect(backend.state.writes).toEqual([
      [
        'POST',
        {
          name: 'Review queue',
          query: 'status = "Code review"',
          projectId: PROJECT.id,
          sharedWith: [PLATFORM],
        },
      ],
    ]);
    await waitFor(() => expect(result.current.mine).toHaveLength(2));
  });

  it('renames and deletes my own filter', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.mine).toHaveLength(1));
    const [mine] = result.current.mine;
    await act(() => result.current.rename.mutateAsync({ id: mine!.id, name: 'Mine, open' }));
    await waitFor(() => expect(result.current.mine[0]?.name).toBe('Mine, open'));
    await act(() => result.current.remove.mutateAsync(mine!.id));
    await waitFor(() => expect(result.current.mine).toHaveLength(0));
    expect(backend.state.writes.map(([method]) => method)).toEqual(['PATCH', 'DELETE']);
  });
});
