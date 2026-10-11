import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigation } from '../../hooks/use-sso-admin.ts';
import { ssoOf } from '../../mocks/routes/sso.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { AuthenticationPage } from './authentication-page.tsx';

afterEach(() => vi.restoreAllMocks());

async function addOidcProvider(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add identity provider…' }));
  await user.click(await screen.findByRole('radio', { name: /Other OpenID Connect/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Add Other OpenID Connect' });
  await user.clear(within(dialog).getByLabelText('Name on the sign-in page'));
  await user.type(within(dialog).getByLabelText('Name on the sign-in page'), 'Acme sign-in');
  await user.type(within(dialog).getByLabelText('Issuer URL'), 'https://id.acme.dev');
  await user.type(within(dialog).getByLabelText('Client ID'), 'bemmoly');
  await user.type(within(dialog).getByLabelText('Client secret'), 'a-test-only-secret');
  await user.click(within(dialog).getByRole('button', { name: 'Add provider' }));
  return dialog;
}

// Each test drives dialogs through several screens; shared CI runners take well over 5s.
describe('AuthenticationPage', { timeout: 20_000 }, () => {
  it('starts with password on, single sign-on not set up and the policy locked', async () => {
    await renderPage(() => <AuthenticationPage />);
    expect(await screen.findByText('Password')).toBeTruthy();
    expect(screen.getByText('Not set up')).toBeTruthy();
    const requireSwitch = screen.getByRole('switch', {
      name: 'Require single sign-on for everyone',
    });
    expect(requireSwitch.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('Run a successful test sign-in with an identity provider first.'),
    ).toBeTruthy();
  });

  it('adds a provider, shows what to paste into the identity provider, and never echoes the secret', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AuthenticationPage />);
    await addOidcProvider(user);
    const edit = await screen.findByRole('dialog', { name: 'Edit Acme sign-in' });
    const redirect = within(edit).getByLabelText('Redirect URI') as HTMLInputElement;
    expect(redirect.value).toMatch(/\/api\/v1\/auth\/sso\/providers\/.+\/callback$/);
    const [stored] = ssoOf(mockApi.db).providers;
    expect(stored).toMatchObject({ displayName: 'Acme sign-in', preset: 'oidc' });
    expect(JSON.stringify(stored)).not.toContain('a-test-only-secret');
    expect(within(edit).getByText('Stored encrypted. Leave empty to keep it.')).toBeTruthy();
  });

  it('runs a test sign-in, then requires single sign-on after asking', async () => {
    const user = userEvent.setup();
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    await renderPage(() => <AuthenticationPage />);
    await addOidcProvider(user);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Test sign-in' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/settings/authentication'));

    const view = await renderPage(() => <AuthenticationPage />);
    const requireSwitch = await within(view.container).findByRole('switch', {
      name: 'Require single sign-on for everyone',
    });
    await waitFor(() => expect(requireSwitch.hasAttribute('disabled')).toBe(false));
    await user.click(requireSwitch);
    const confirm = await screen.findByRole('dialog', {
      name: 'Require single sign-on for everyone?',
    });
    expect(within(confirm).getByText(/Break-glass admins keep their password/)).toBeTruthy();
    await user.click(within(confirm).getByRole('button', { name: 'Require single sign-on' }));
    await waitFor(() => expect(ssoOf(mockApi.db).requireSso).toBe(true));
    expect(await within(view.container).findByText('Break-glass only')).toBeTruthy();
  });

  it('creates a SCIM token and shows it once beside the base URL', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AuthenticationPage />);
    await user.click(await screen.findByRole('button', { name: 'Create token…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a SCIM token' });
    await user.click(within(dialog).getByRole('button', { name: 'Create token' }));
    const shown = await screen.findByRole('dialog', { name: 'Copy the token now' });
    expect((within(shown).getByLabelText('Token') as HTMLInputElement).value).toMatch(/^bmscim_/);
    expect((within(shown).getByLabelText('Base URL') as HTMLInputElement).value).toMatch(
      /\/scim\/v2$/,
    );
    await user.click(within(shown).getByRole('button', { name: 'Done' }));
    const table = await screen.findByRole('table', { name: 'SCIM tokens' });
    expect(await within(table).findByText('Directory sync')).toBeTruthy();
  });

  it('makes and removes break-glass admins, naming each, and always keeps one', async () => {
    const user = userEvent.setup();
    const db = mockApi.db;
    const adminRole = db.roles.find((role) => role.key === 'org_admin')!.id;
    const lena = db.users.find((person) => person.name === 'Lena T.')!;
    lena.roleId = adminRole;
    ssoOf(db).requireSso = true;
    await renderPage(() => <AuthenticationPage />);
    const list = await screen.findByRole('list', { name: 'Org admins' });
    const rohan = within(list).getByRole('button', { name: /^Remove… ?, Rohan S\.$/ });
    expect(rohan.hasAttribute('disabled')).toBe(true);
    expect(
      within(list).getByText('The last break-glass admin stays while single sign-on is required.'),
    ).toBeTruthy();

    await user.click(within(list).getByRole('button', { name: /^Make break-glass… ?, Lena T\.$/ }));
    const make = await screen.findByRole('dialog', { name: 'Make Lena T. a break-glass admin?' });
    expect(within(make).getByText(/Every other org admin is told/)).toBeTruthy();
    await user.click(within(make).getByRole('button', { name: 'Make break-glass admin' }));
    await waitFor(() => expect(lena.isBreakGlass).toBe(true));

    const enabled = await within(list).findByRole('button', { name: /^Remove… ?, Rohan S\.$/ });
    await waitFor(() => expect(enabled.hasAttribute('disabled')).toBe(false));
    await user.click(enabled);
    const remove = await screen.findByRole('dialog', {
      name: 'Remove Rohan S. as a break-glass admin?',
    });
    expect(within(remove).getByText(/can no longer sign in with a password/)).toBeTruthy();
    await user.click(within(remove).getByRole('button', { name: 'Remove break-glass admin' }));
    await waitFor(() =>
      expect(db.users.find((person) => person.name === 'Rohan S.')?.isBreakGlass).toBe(false),
    );
  });

  it('tells people without the capability who can change it', async () => {
    mockApi.reset('member');
    await renderPage(() => <AuthenticationPage />);
    expect(await screen.findByText(/Only people who can configure single sign-on/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
