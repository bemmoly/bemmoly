import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useBoardDisplayStore } from '../hooks/board-display.ts';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { testView } from '../hooks/board-fixtures.ts';
import { useBoardLanes } from '../hooks/board-filters.ts';
import { meHandler } from '../projects/test-me.ts';
import { cardEl, renderBoard, sent, server, setWidth } from './test-support.tsx';

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  setWidth(1440);
  sent.patches = [];
  window.localStorage.clear();
  useBoardDisplayStore.setState({ views: {} });
  useBoardLanes.getState().reset();
  window.history.replaceState(null, '', '/work/board/PLT');
  useBoardDragStore.getState().finish();
});
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

const openDisplay = () => fireEvent.click(screen.getByRole('button', { name: /^Display/ }));
const option = (name: string) => screen.getByRole('menuitemcheckbox', { name });

describe('Board display menu', () => {
  it('offers no card fields or density to anyone; cards follow the board', async () => {
    await renderBoard();
    openDisplay();
    for (const name of ['Key', 'Priority', 'Assignee', 'Labels', 'Time in column']) {
      expect(screen.queryByRole('menuitemcheckbox', { name })).toBeNull();
    }
    expect(screen.queryByRole('menuitemradio', { name: 'Compact' })).toBeNull();
    // A member is told where the layout is set, with nothing to press.
    expect(screen.getByText(/Card layout is set by project admins/)).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Edit card layout/ })).toBeNull();
  });

  it('ignores card fields a person stored before cards became the board’s', async () => {
    window.localStorage.setItem(
      'bemmoly.work.board-display',
      JSON.stringify({
        state: {
          views: {
            [`anonymous:${testView().board.id}`]: {
              fields: { key: false },
              showEmptyColumns: true,
            },
          },
        },
        version: 1,
      }),
    );
    await useBoardDisplayStore.persist.rehydrate();
    await renderBoard();
    expect(within(cardEl('PLT-10')).getByText('PLT-10')).toBeTruthy();
  });

  it('draws only the fields the board settings choose', async () => {
    const view = testView();
    server.use(
      http.get('*/api/v1/work/boards/:id/view', () =>
        HttpResponse.json({
          ...view,
          board: { ...view.board, config: { ...view.board.config, cardFields: ['type'] } },
        }),
      ),
    );
    await renderBoard();
    expect(within(cardEl('PLT-10')).queryByText('PLT-10')).toBeNull();
  });

  it('links admins to the Cards tab of Board settings', async () => {
    server.use(meHandler(['work.board.configure']));
    await renderBoard();
    openDisplay();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit card layout in settings' }));
    expect(window.location.pathname + window.location.search).toBe(
      '/work/settings/PLT/board?tab=cards',
    );
  });

  it('steps empty columns aside when Show empty columns is off, and resets', async () => {
    await renderBoard();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter this board' }), {
      target: { value: 'Issue 10' },
    });
    await waitFor(() => expect(document.querySelectorAll('[data-issue-key]')).toHaveLength(1));
    expect(screen.getByRole('group', { name: 'Done, Auth service' })).toBeTruthy();
    openDisplay();
    fireEvent.click(option('Show empty columns'));
    expect(screen.queryByRole('group', { name: 'Done, Auth service' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'In progress, Auth service' })).toBeNull();
    expect(screen.getByRole('group', { name: 'To do, Auth service' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /changed from the board's default/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: "Reset to the board's default" }));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Done, Auth service' })).toBeTruthy(),
    );
  });
});
