import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { TeamsPage } from './teams-page.tsx';

describe('TeamsPage', () => {
  it('lists teams as table rows with their lead, members and default role', async () => {
    await renderPage(() => <TeamsPage />);
    const table = await screen.findByRole('table', { name: 'Teams' });
    const headings = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headings).toEqual([
      'Team',
      'Lead',
      'Members',
      'Module access',
      'Default role',
      'Actions',
    ]);
    const mobile = (await within(table).findByText('Mobile')).closest(
      '[role="row"]',
    ) as HTMLElement;
    expect(within(mobile).getByText('Jonas M.')).toBeTruthy();
    expect(within(mobile).getByText('6')).toBeTruthy();
  });

  it('deletes a team only after its name is typed', async () => {
    const user = userEvent.setup();
    await renderPage(() => <TeamsPage />);
    await user.click(await screen.findByRole('button', { name: 'Actions for Design' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete team…' }));
    const confirm = screen.getByRole('button', { name: 'Delete team' });
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(screen.getByRole('textbox'), 'Design');
    await user.click(confirm);
    await waitFor(() =>
      expect(mockApi.db.teams.some((team) => team.name === 'Design')).toBe(false),
    );
  });
});
