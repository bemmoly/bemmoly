import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedFilters } from '../hooks/saved-filters.ts';
import {
  filtersBackend,
  PLATFORM,
  PROJECT,
  useTestOrigin,
} from '../hooks/saved-filters-backend.ts';
import { SavedFiltersMenu } from './saved-filters-menu.tsx';

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

function Harness({ applied, onApply }: { applied: string; onApply: (query: string) => void }) {
  const filters = useSavedFilters(PROJECT);
  return <SavedFiltersMenu filters={filters} applied={applied} onApply={onApply} />;
}

function show(applied = '') {
  const onApply = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Harness applied={applied} onApply={onApply} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onApply;
}

const openMenu = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
  return screen.findByRole('menu');
};

describe('SavedFiltersMenu', () => {
  it("lists mine and my teams' filters and applies one in a click", async () => {
    const onApply = show();
    await waitFor(() => expect(backend.state.filters).toHaveLength(2));
    const menu = await openMenu();
    expect(await within(menu).findByRole('group', { name: 'Mine' })).toBeTruthy();
    const shared = within(menu).getByRole('group', { name: 'Shared with me' });
    fireEvent.click(within(shared).getByRole('menuitem', { name: /Waiting for review/ }));
    expect(onApply).toHaveBeenCalledWith('status = "Code review"');
    expect(screen.queryByRole('button', { name: 'Save filter' })).toBeNull();
  });

  it('saves the applied query shared with one of my teams', async () => {
    show('priority = Highest');
    fireEvent.click(await screen.findByRole('button', { name: 'Save filter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save filter' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Urgent' } });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Who sees it' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Platform' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save filter' }));
    await waitFor(() =>
      expect(backend.state.writes).toEqual([
        [
          'POST',
          {
            name: 'Urgent',
            query: 'priority = Highest',
            projectId: PROJECT.id,
            sharedWith: [PLATFORM],
          },
        ],
      ]),
    );
    expect(await screen.findByText('Saved "Urgent"')).toBeTruthy();
  });

  it('deletes my own filter after the confirmation', async () => {
    show();
    const menu = await openMenu();
    fireEvent.click(await within(menu).findByRole('menuitem', { name: 'Rename or delete…' }));
    const dialog = await screen.findByRole('dialog', { name: 'My saved filters' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete "My open work"?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete filter' }));
    const mine = backend.state.filters[0]!.id;
    await waitFor(() => expect(backend.state.writes).toEqual([['DELETE', mine]]));
    expect(backend.state.filters.map((filter) => filter.name)).toEqual(['Waiting for review']);
  });
});
