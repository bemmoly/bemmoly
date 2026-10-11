import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ROLE_IDS, USER_IDS } from '../../mocks/seed/people.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { UsersPage } from './users-page.tsx';

describe('UsersPage', () => {
  it('narrows the table with the segments and marks your own row', async () => {
    const user = userEvent.setup();
    await renderPage(() => <UsersPage />);
    const table = await screen.findByRole('table', { name: 'Users' });
    expect(await within(table).findByText('You')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /Invited/ }));
    await waitFor(() => expect(within(table).queryByText('You')).toBeNull());
    await user.click(screen.getByRole('radio', { name: /All/ }));
    expect(await within(table).findByText('You')).toBeTruthy();
  });

  it('changes a role from the inline menu', async () => {
    const user = userEvent.setup();
    await renderPage(() => <UsersPage />);
    const trigger = await screen.findByRole('button', { name: /^Role for Aisha K\./ });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitemradio', { name: 'Viewer' }));
    await waitFor(() =>
      expect(mockApi.db.users.find((row) => row.id === USER_IDS.aisha)?.roleId).toBe(
        ROLE_IDS.viewer,
      ),
    );
  });
});
