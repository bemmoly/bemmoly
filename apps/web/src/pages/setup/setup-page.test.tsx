import { useSearch } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from '../../store/setup.ts';
import { renderPage, testQueryClient } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { SetupWizard } from './setup-wizard.tsx';

/** The test router has no /setup route, so the step comes from the loose search. */
function Harness() {
  const search = useSearch({ strict: false }) as { step?: number };
  return <SetupWizard requestedStep={search.step} />;
}

beforeEach(() => useSetupStore.getState().reset());

describe('SetupPage', () => {
  it('shows the Postgres 18 check and the admin form on a fresh install', async () => {
    mockApi.reset('fresh');
    await renderPage(() => <Harness />, '/setup', testQueryClient());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your server is up' }),
    ).toBeTruthy();
    const checks = screen.getByLabelText('Server checks');
    expect(within(checks).getByText('Postgres 18')).toBeTruthy();
    expect(await within(checks).findByText('localhost:5432 · 12 ms')).toBeTruthy();
    expect(screen.getByLabelText('Workspace name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create admin and continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Setup steps' });
    expect(
      within(rail).getByText('Everything here can be changed later in Workspace settings.'),
    ).toBeTruthy();
  });

  it('groups the admin form into the workspace and the account', async () => {
    mockApi.reset('fresh');
    await renderPage(() => <Harness />, '/setup', testQueryClient());
    const workspace = await screen.findByRole('group', { name: 'Workspace' });
    expect(workspace.getAttribute('aria-describedby')).toBeTruthy();
    expect(within(workspace).getByLabelText('Workspace name')).toBeTruthy();
    expect(within(workspace).getByLabelText('URL')).toHaveProperty('value', window.location.origin);
    const account = screen.getByRole('group', { name: 'Your account' });
    expect(
      ['Your name', 'Email', 'Password'].map((label) => within(account).getByLabelText(label)),
    ).toHaveLength(3);
    expect(within(account).queryByLabelText('Workspace name')).toBeNull();
  });

  it('heads the email invites with their defaults', async () => {
    mockApi.reset('wizard');
    await renderPage(() => <Harness />, '/setup?step=3', testQueryClient());
    const invites = await screen.findByRole('region', { name: 'Or invite by email' });
    expect(within(invites).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(within(invites).getByText(/joins as a Member with no team/)).toBeTruthy();
    expect(within(invites).getByLabelText('Team')).toBeTruthy();
  });

  it('creates the admin and moves to the import step', async () => {
    mockApi.reset('fresh');
    const user = userEvent.setup();
    const { router } = await renderPage(() => <Harness />, '/setup', testQueryClient());
    await user.type(await screen.findByLabelText('Workspace name'), 'Acme Labs');
    const url = screen.getByLabelText('URL');
    await user.clear(url);
    await user.type(url, 'https://bemmoly.example');
    await user.type(screen.getByLabelText('Your name'), 'Rohan S.');
    await user.type(screen.getByLabelText('Email'), 'rohan@acme.test');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Create admin and continue' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bring your data, or start clean' }),
    ).toBeTruthy();
    expect(mockApi.db.initialized).toBe(true);
    expect(mockApi.db.settings['workspace.name']).toBe('Acme Labs');
    expect(router.state.location.search).toEqual({ step: 2 });
    expect(screen.getByRole('button', { name: 'Start import in background' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
  });

  it('keeps the form open and says why when a field is wrong', async () => {
    mockApi.reset('fresh');
    const user = userEvent.setup();
    await renderPage(() => <Harness />, '/setup', testQueryClient());
    await user.click(await screen.findByRole('button', { name: 'Create admin and continue' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(mockApi.db.initialized).toBe(false);
  });
});
