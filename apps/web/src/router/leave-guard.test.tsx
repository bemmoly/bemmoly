import { navigateInApp, setShellNavigator, useLeaveGuard } from '@bemmoly/core-web';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderPage } from '../test/render.tsx';

/* The shell's leave guard as a module chunk sees it: no router import, only core-web. */

function Draft() {
  const [dirty, setDirty] = useState(true);
  const guard = useLeaveGuard({ when: dirty });
  return (
    <div>
      <p>{guard.blocked ? `Leaving for ${guard.to}` : 'Editing'}</p>
      <button onClick={guard.stay}>Stay</button>
      <button onClick={guard.leave}>Leave</button>
      <button onClick={() => setDirty(false)}>Save</button>
    </div>
  );
}

describe('the shell leave guard', () => {
  afterEach(() => setShellNavigator(null));

  it('holds a move to another page until the person stays or leaves', async () => {
    const { router } = await renderPage(() => <Draft />, '/work/settings/PLT/board');
    setShellNavigator((path) => router.history.push(path));
    await screen.findByText('Editing');

    act(() => navigateInApp('/settings/workspace'));
    expect(await screen.findByText('Leaving for /settings/workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    await screen.findByText('Editing');
    expect(router.state.location.pathname).toBe('/work/settings/PLT/board');

    act(() => void router.navigate({ to: '/inbox' }));
    await screen.findByText('Leaving for /inbox');
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/inbox'));
  });

  it('lets every move through once nothing is unsaved', async () => {
    const { router } = await renderPage(() => <Draft />, '/work/settings/PLT/board');
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    act(() => void router.navigate({ to: '/inbox' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/inbox'));
  });
});
