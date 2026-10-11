import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { testView } from '../hooks/board-fixtures.ts';
import { useBoardLanes } from '../hooks/board-filters.ts';
import { buildBoardModel } from '../hooks/board-model.ts';
import { selectableOrder, useBoardSelectionStore } from '../hooks/board-selection.ts';
import { useHiddenIssues } from '../hooks/issue-quick-actions.ts';
import {
  cardEl,
  key,
  projectsAnswer,
  renderBoard,
  renderScreen,
  sent,
  server,
  setWidth,
} from './test-support.tsx';

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  setWidth(1440);
  sent.patches = [];
  useBoardLanes.getState().reset();
  useBoardSelectionStore.setState({ boardId: null, selection: { ids: [], anchor: null } });
  useHiddenIssues.setState({ keys: new Set() });
  window.history.replaceState(null, '', '/work/board/PLT');
  useBoardDragStore.getState().finish();
});
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

/** A card's box, which it draws once the pointer reaches it, as a person's would. */
const box = (issueKey: string) => {
  fireEvent.pointerEnter(cardEl(issueKey));
  return screen.getByRole('checkbox', { name: `Select ${issueKey}` });
};
const bar = () => screen.queryByRole('toolbar', { name: /selected$/ });
const selected = () => useBoardSelectionStore.getState().selection.ids;

describe('selectableOrder', () => {
  it('runs lane by lane, column by column, and skips folded lanes', () => {
    const model = buildBoardModel(testView());
    const order = selectableOrder(model, []);
    expect(order).toEqual(['PLT-10', 'PLT-11', 'PLT-12', 'PLT-13', 'PLT-14', 'PLT-15']);
    expect(selectableOrder(model, ['none'])).not.toContain('PLT-15');
  });
});

describe('Board selection', () => {
  it('toggles with the box, extends with Shift, toggles with Cmd and still opens on a click', async () => {
    await renderBoard();
    fireEvent.click(box('PLT-10'));
    expect(bar()?.getAttribute('aria-label')).toBe('1 issue selected');
    fireEvent.click(box('PLT-13'), { shiftKey: true });
    expect(selected()).toEqual(['PLT-10', 'PLT-11', 'PLT-12', 'PLT-13']);
    fireEvent.click(cardEl('PLT-11'), { metaKey: true });
    expect(selected()).toEqual(['PLT-10', 'PLT-12', 'PLT-13']);
    expect(cardEl('PLT-12').getAttribute('aria-label')).toBe('PLT-12 Issue 12, selected');
    expect(new URLSearchParams(window.location.search).get('issue')).toBeNull();

    fireEvent.click(cardEl('PLT-14'));
    await screen.findByRole('complementary', { name: 'PLT-14 details' });
    expect(selected()).toHaveLength(3);
  });

  it('selects from the keyboard with x and Shift+x, and Esc clears', async () => {
    await renderBoard();
    key(cardEl('PLT-12'), 'x');
    key(cardEl('PLT-15'), 'X', { shiftKey: true });
    expect(selected()).toEqual(['PLT-12', 'PLT-13', 'PLT-14', 'PLT-15']);
    expect(bar()?.getAttribute('aria-label')).toBe('4 issues selected');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(bar()).toBeNull());
  });

  it('deletes the whole selection from a selected card, with Undo', async () => {
    await renderBoard();
    fireEvent.click(box('PLT-10'));
    fireEvent.click(box('PLT-11'));
    key(cardEl('PLT-11'), 'Delete');
    expect(await screen.findByText('2 issues deleted')).toBeTruthy();
    expect([...useHiddenIssues.getState().keys]).toEqual(['PLT-10', 'PLT-11']);
    expect(document.querySelector('[data-issue-key="PLT-10"]')).toBeNull();
    expect(bar()).toBeNull();
  });

  it('drops a card from the selection once a filter hides it', async () => {
    await renderBoard();
    fireEvent.click(box('PLT-10'));
    fireEvent.click(box('PLT-15'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter this board' }), {
      target: { value: 'Issue 10' },
    });
    await waitFor(() => expect(selected()).toEqual(['PLT-10']));
  });

  it('draws a card’s tools once it is reached, and right-click opens its menu either way', async () => {
    await renderBoard();
    expect(screen.queryByRole('button', { name: 'Open PLT-10' })).toBeNull();
    fireEvent.pointerEnter(cardEl('PLT-10'));
    expect(screen.getByRole('button', { name: 'Open PLT-10' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Actions for PLT-11' })).toBeNull();
    fireEvent.contextMenu(cardEl('PLT-11'));
    expect(await screen.findByRole('menuitem', { name: 'Open full page' })).toBeTruthy();
  });

  it('offers Move to on a Scrum board and leaves it out on Kanban', async () => {
    await renderBoard();
    fireEvent.click(box('PLT-10'));
    expect(within(bar() as HTMLElement).queryByRole('button', { name: 'Move to' })).toBeNull();
    cleanup();

    server.use(projectsAnswer('scrum'));
    renderScreen('PLT');
    await screen.findByRole('heading', { name: 'No active sprint' });
    fireEvent.click(within(bar() as HTMLElement).getByRole('button', { name: 'Move to' }));
    expect(screen.getByRole('menuitem', { name: 'Backlog' })).toBeTruthy();
  });
});
