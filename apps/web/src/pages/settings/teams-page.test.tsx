import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { TeamsPage } from './teams-page.tsx';

describe('TeamsPage', () => {
  it('lists teams as table rows with their lead, members and modules', async () => {
    await renderPage(() => <TeamsPage />);
    const table = await screen.findByRole('table', { name: 'Teams' });
    const headings = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headings).toEqual(['Team', 'Lead', 'Members', 'Module access', 'Actions']);
    const mobile = (await within(table).findByText('Mobile')).closest(
      '[role="row"]',
    ) as HTMLElement;
    expect(within(mobile).getByText('Jonas M.')).toBeTruthy();
    expect(within(mobile).getByText('6')).toBeTruthy();
  });

  it('renames a team and changes its lead, who joins the team', async () => {
    const user = userEvent.setup();
    await renderPage(() => <TeamsPage />);
    await user.click(await screen.findByRole('button', { name: 'Actions for Design' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit team…' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Design' });
    const name = within(dialog).getByRole('textbox');
    await user.clear(name);
    await user.type(name, 'Product design');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mockApi.db.teams.some((team) => team.name === 'Product design')).toBe(true),
    );
  });

  it('adds and removes members, but never the lead', async () => {
    const user = userEvent.setup();
    await renderPage(() => <TeamsPage />);
    await user.click(await screen.findByRole('button', { name: 'Actions for Mobile' }));
    await user.click(screen.getByRole('menuitem', { name: 'Manage members…' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile members' });
    const list = await within(dialog).findByRole('list', { name: 'Members of Mobile' });
    expect(within(list).getByText('Lead')).toBeTruthy();
    expect(
      within(list).getByRole('button', { name: 'Change the lead to remove them' }),
    ).toHaveProperty('disabled', true);
    const mobile = mockApi.db.teams.find((team) => team.name === 'Mobile')!;
    await user.click(within(list).getByRole('button', { name: 'Remove Dev P.' }));
    await waitFor(() =>
      expect(
        mockApi.db.teamMembers.filter((row) => row.teamId === mobile.id).map((row) => row.userId),
      ).not.toContain(mockApi.db.users.find((u) => u.name === 'Dev P.')?.id),
    );
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
