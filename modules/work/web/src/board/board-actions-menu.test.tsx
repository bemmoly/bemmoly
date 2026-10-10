import type { Project } from '@bemmoly/module-work/shared';
import { ToastProvider } from '@bemmoly/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardActionsMenu } from './board-actions-menu.tsx';

const PROJECT: Project = {
  id: '018f0000-0000-7000-8000-000000000050',
  key: 'PLT',
  name: 'Platform Core',
  description: null,
  teamId: null,
  method: 'scrum',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const writeText = vi.fn<(text: string) => Promise<void>>();

function openMenu() {
  render(
    <ToastProvider>
      <BoardActionsMenu project={PROJECT} boardName="PLT board" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Board actions' }));
}

const choose = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }));

beforeEach(() => {
  window.history.replaceState(null, '', '/work/board/PLT');
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Board actions menu', () => {
  it('offers only the board pages that exist and the board link', () => {
    openMenu();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Board settings',
      'Workflow',
      'Copy board link',
    ]);
  });

  it('opens the board settings', async () => {
    openMenu();
    choose('Board settings');
    expect(window.location.pathname).toBe('/work/settings/PLT/board');
    // The menu fades out for 100ms before it leaves the page.
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('opens the project workflows', () => {
    openMenu();
    choose('Workflow');
    expect(window.location.pathname).toBe('/work/workflows/PLT');
  });

  it('copies the board address and says so', async () => {
    openMenu();
    choose('Copy board link');
    expect(await screen.findByText('Link to PLT board copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/work/board/PLT`);
  });

  it('shows the address when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    openMenu();
    choose('Copy board link');
    expect(await screen.findByText('Copy the link from the address bar')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText(`${window.location.origin}/work/board/PLT`)).toBeTruthy(),
    );
  });
});
