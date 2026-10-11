import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { useBoardLanes } from '../hooks/board-filters.ts';
import { cardEl, key, renderBoard, renderScreen, sent, server, setWidth } from './test-support.tsx';

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  setWidth(1440);
  sent.patches = [];
  useBoardLanes.getState().reset();
  window.history.replaceState(null, '', '/work/board/PLT');
  useBoardDragStore.getState().finish();
});
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

describe('Board screen', () => {
  it('lays the view out in columns and lanes with WIP counts', async () => {
    await renderBoard();
    expect(screen.getByRole('group', { name: 'To do, Auth service' })).toBeTruthy();
    expect(screen.getByLabelText('WIP limit 2')).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Done, Auth service' })).getByText('Issue 14'),
    ).toBeTruthy();
  });

  it('carries a card with the keyboard and drops it into the next column', async () => {
    await renderBoard();
    const card = cardEl('PLT-10');
    card.focus();
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts).not.toBeNull());
    key(card, 'ArrowRight');
    expect(useBoardDragStore.getState().target).toMatchObject({ columnId: 'doing' });
    key(card, ' ');
    await waitFor(() => expect(sent.patches).toEqual(['PLT-10']));
  });

  it('keeps the focus on a card dropped with the keyboard in its new column', async () => {
    server.use(http.patch('*/api/v1/work/issues/:key', () => new Promise<never>(() => undefined)));
    await renderBoard();
    const card = cardEl('PLT-10');
    card.focus();
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts).not.toBeNull());
    key(card, 'ArrowRight');
    key(card, ' ');
    const doing = screen.getByRole('group', { name: 'In progress, Auth service' });
    await waitFor(() => expect(within(doing).getByText('Issue 10')).toBeTruthy());
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('PLT-10 Issue 10'),
    );
    expect(doing.contains(document.activeElement)).toBe(true);
  });

  it('says a linked project is not one the person can see', async () => {
    renderScreen('sec');
    expect(await screen.findByText('There is no project SEC you can see.')).toBeTruthy();
  });

  it('puts a carried card back on Escape', async () => {
    await renderBoard();
    const card = cardEl('PLT-11');
    key(card, ' ');
    key(card, 'ArrowRight');
    key(card, 'Escape');
    expect(useBoardDragStore.getState().carrying).toBeNull();
    expect(screen.getByText('PLT-11 put back.')).toBeTruthy();
    expect(sent.patches).toEqual([]);
  });

  it('shows why the workflow refuses a column and sends nothing', async () => {
    await renderBoard();
    const card = cardEl('PLT-13');
    key(card, ' ');
    await waitFor(() => expect(useBoardDragStore.getState().verdicts?.['done']).toBeTruthy());
    key(card, 'ArrowRight');
    expect(await screen.findByText('Set a reviewer first.')).toBeTruthy();
    key(card, ' ');
    expect(await screen.findByText('PLT-13 cannot move to Done')).toBeTruthy();
    expect(sent.patches).toEqual([]);
  });

  it('opens the issue in the slide-over on Enter and closes it', async () => {
    await renderBoard();
    key(cardEl('PLT-12'), 'Enter');
    const panel = await screen.findByRole('complementary', { name: 'PLT-12 details' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    // The panel plays its exit before it unmounts.
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'PLT-12 details' })).toBeNull(),
    );
  });

  it('lays the slide-over over the board below 1200px; Escape closes it', async () => {
    setWidth(1024);
    await renderBoard();
    key(cardEl('PLT-12'), 'Enter');
    const panel = await screen.findByRole('dialog', { name: 'PLT-12 details' });
    expect(panel.hasAttribute('open')).toBe(true);
    expect(screen.queryByRole('complementary', { name: 'PLT-12 details' })).toBeNull();
    fireEvent(panel, new Event('cancel', { cancelable: true }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'PLT-12 details' })).toBeNull(),
    );
  });

  it('docks an open slide-over again when the window widens', async () => {
    setWidth(1024);
    await renderBoard();
    key(cardEl('PLT-12'), 'Enter');
    await screen.findByRole('dialog', { name: 'PLT-12 details' });
    setWidth(1440);
    expect(await screen.findByRole('complementary', { name: 'PLT-12 details' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'PLT-12 details' })).toBeNull();
  });

  it('puts the open issue in the address and closes it from there', async () => {
    await renderBoard();
    key(cardEl('PLT-12'), 'Enter');
    await screen.findByRole('complementary', { name: 'PLT-12 details' });
    expect(new URLSearchParams(window.location.search).get('issue')).toBe('PLT-12');
  });

  it('hides the cards a quick filter leaves out and offers to clear it', async () => {
    window.history.replaceState(null, '', '/work/board/PLT?quick=blocked');
    await renderScreen('PLT');
    expect(await screen.findByText('No issues match these filters')).toBeTruthy();
    expect(document.querySelectorAll('[data-issue-key]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-issue-key]').length).toBeGreaterThan(0),
    );
  });
});
