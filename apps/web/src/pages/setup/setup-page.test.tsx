import { useSearch } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent, type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { requireSetupOpen } from '../../router/guards.ts';
import { useSetupStore } from '../../store/setup.ts';
import { renderPage, testQueryClient } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { SetupWizard } from './setup-wizard.tsx';

/** The test router has no /setup route, so the step comes from the loose search. */
function Harness() {
  const search = useSearch({ strict: false }) as { step?: number };
  return <SetupWizard requestedStep={search.step} />;
}

/**
 * The /setup route's guard loads setup status (and the admin's session, once there is one)
 * before the wizard mounts; run it here too, so a step renders as it does in the app instead
 * of starting from a loading state the app never shows.
 */
async function setupClient() {
  const client = testQueryClient();
  await requireSetupOpen(client);
  return client;
}

/** Puts a whole value into a field at once; these tests are about the steps, not keystrokes. */
async function fill(user: UserEvent, field: HTMLElement, value: string) {
  await user.click(field);
  await user.paste(value);
}

beforeEach(() => useSetupStore.getState().reset());

describe('SetupPage', () => {
  it('welcomes a fresh install with the health summary and the workspace step', async () => {
    mockApi.reset('fresh');
    await renderPage(() => <Harness />, '/setup', await setupClient());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to Bemmoly' }),
    ).toBeTruthy();
    const health = screen.getByRole('region', { name: 'Server health' });
    // The SMTP warning opens the details on its own and says where to fix it.
    const checks = await within(health).findByLabelText('Server checks');
    expect(within(checks).getByText('Postgres 18')).toBeTruthy();
    expect(within(checks).getByText('Configure later in Settings › Email')).toBeTruthy();
    expect(screen.getByLabelText('Workspace name')).toBeTruthy();
    expect(screen.getByLabelText('URL')).toHaveProperty('value', window.location.origin);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getAllByText('Step 1 of 7').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Setup steps' })).toBeTruthy();
  });

  it('checks the workspace name on Continue without leaving the step', async () => {
    mockApi.reset('fresh');
    const user = userEvent.setup();
    const { router } = await renderPage(() => <Harness />, '/setup', await setupClient());
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Workspace name').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(router.state.location.search).toEqual({});
  });

  it('creates the account with the workspace and moves to the import step', async () => {
    mockApi.reset('fresh');
    const user = userEvent.setup();
    const { router } = await renderPage(() => <Harness />, '/setup', await setupClient());
    await fill(user, await screen.findByLabelText('Workspace name'), 'Acme Labs');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeTruthy();
    await fill(user, screen.getByLabelText('Your name'), 'Rohan S.');
    await fill(user, screen.getByLabelText('Email'), 'rohan@acme.test');
    const password = screen.getByLabelText('Password');
    await fill(user, password, 'a long enough password');
    expect(password.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bring your data, or start clean' }),
    ).toBeTruthy();
    expect(mockApi.db.initialized).toBe(true);
    expect(mockApi.db.settings['workspace.name']).toBe('Acme Labs');
    expect(router.state.location.search).toEqual({ step: 3 });
    const sources = screen.getByRole('radiogroup', { name: 'Import source' });
    expect(
      within(sources)
        .getByRole('radio', { name: /Start clean/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(sources).getAllByText('Coming soon')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
  });

  it('heads the email invites with their defaults', async () => {
    mockApi.reset('wizard');
    await renderPage(() => <Harness />, '/setup?step=4', await setupClient());
    const invites = await screen.findByRole('region', { name: 'Invite by email' });
    expect(within(invites).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(within(invites).getByLabelText('Team')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('shows the brand color inline on the look step', async () => {
    mockApi.reset('wizard');
    const user = userEvent.setup();
    const { router } = await renderPage(() => <Harness />, '/setup?step=6', await setupClient());
    const brand = await screen.findByRole('region', { name: 'Brand color' });
    const toggle = within(brand).getByRole('button', { expanded: false });
    await user.click(toggle);
    expect(router.state.location.search).toEqual({ step: 6 });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const tiles = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(tiles).queryByRole('radio', { checked: true })).toBeNull();
    await user.click(within(tiles).getByRole('radio', { name: /Forest/ }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('ends on a launchpad that lists the summary as labels and values', async () => {
    mockApi.reset('wizard');
    await renderPage(() => <Harness />, '/setup?step=7', await setupClient());
    const summary = await screen.findByLabelText('Setup summary');
    expect(summary.tagName).toBe('DL');
    const terms = within(summary).getAllByRole('term');
    expect(terms.map((term) => term.lastChild?.textContent)).toEqual([
      'Workspace',
      'Admin',
      'Import',
      'Sign-in',
      'AI',
      'Theme',
    ]);
    expect(within(summary).getAllByText('Do it now')).toHaveLength(2);
    // The test router has none of these routes, so the cards render without an href.
    expect(screen.getByText(/Turn on Work|Create your first project/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Bemmoly' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
