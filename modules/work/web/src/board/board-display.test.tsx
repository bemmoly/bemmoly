import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useBoardDisplayStore } from '../hooks/board-display.ts';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { useBoardLanes } from '../hooks/board-filters.ts';
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
  it('hides a card field for this person once it is turned off, and can be reset', async () => {
    await renderBoard();
    expect(within(cardEl('PLT-10')).getByText('PLT-10')).toBeTruthy();
    openDisplay();
    // Kanban cards show the time in the column, not points.
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Points' })).toBeNull();
    expect(option('Key').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(option('Key'));
    expect(within(cardEl('PLT-10')).queryByText('PLT-10')).toBeNull();
    // The menu stays open for the next change.
    expect(option('Key').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: /changed from the board's default/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: "Reset to the board's default" }));
    await waitFor(() => expect(within(cardEl('PLT-10')).getByText('PLT-10')).toBeTruthy());
  });

  it('steps empty columns aside when Show empty columns is off', async () => {
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
  });

  it('draws compact cards with the title kept to two lines', async () => {
    await renderBoard();
    openDisplay();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Compact' }));
    expect(within(cardEl('PLT-10')).getByText('Issue 10').className).toContain('line-clamp-2');
  });
});
