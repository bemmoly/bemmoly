import { screen, waitFor } from '@testing-library/react';
import { userEvent, type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLoginForm } from '../../hooks/use-auth-forms.ts';
import { forgetSignIn, readLastSignIn } from '../../hooks/use-last-sign-in.ts';
import { MOCK_PASSWORD } from '../../mocks/db.ts';
import { MOCK_SIGN_IN_BUDGET } from '../../mocks/routes/sign-in.ts';
import { renderPage, testQueryClient } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { DeactivatedNote, PasswordSignIn } from './password-sign-in.tsx';

function Harness() {
  const form = useLoginForm(undefined);
  if (form.failure?.kind === 'deactivated') {
    return <DeactivatedNote workspace="Acme Labs" onStartOver={form.startOver} />;
  }
  if (form.signedIn) return <p>Signed in as {form.signedIn.name}</p>;
  return <PasswordSignIn form={form} workspace="Acme Labs" autoFocus />;
}

async function signIn(user: UserEvent, email: string, password: string) {
  const emailField = await screen.findByLabelText('Email');
  await user.clear(emailField);
  await user.type(emailField, email);
  const passwordField = screen.getByLabelText('Password');
  await user.clear(passwordField);
  await user.type(passwordField, password);
  await user.keyboard('{Enter}');
}

beforeEach(() => {
  mockApi.reset('signed-out');
  forgetSignIn();
});

describe('PasswordSignIn', () => {
  it('names its fields for password managers and focuses the email', async () => {
    await renderPage(() => <Harness />, '/login', testQueryClient());
    const email = await screen.findByLabelText('Email');
    expect(email.getAttribute('name')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(document.activeElement).toBe(email);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
  });

  it('marks a wrong password on the field and selects it', async () => {
    const user = userEvent.setup();
    await renderPage(() => <Harness />, '/login', testQueryClient());
    await signIn(user, 'rohan@acmelabs.dev', 'not the password');
    const message = await screen.findByRole('alert');
    expect(message.textContent).toContain('That email and password don’t match');
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-describedby')).toContain(message.parentElement?.id ?? '-');
    await waitFor(() => expect(password.selectionEnd).toBe(password.value.length));
    expect(password.selectionStart).toBe(0);
  });

  it('counts down from the server’s wait when sign-in is rate limited', async () => {
    const user = userEvent.setup();
    await renderPage(() => <Harness />, '/login', testQueryClient());
    for (let attempt = 0; attempt <= MOCK_SIGN_IN_BUDGET; attempt += 1) {
      await signIn(user, 'rohan@acmelabs.dev', `wrong ${attempt}`);
      await screen.findByRole(attempt < MOCK_SIGN_IN_BUDGET ? 'alert' : 'status');
    }
    expect(await screen.findByText('Too many attempts for this account')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Try again in \d:\d\d/ });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Password')).toHaveProperty('readOnly', true);
  });

  it('says an admin turned the account off, and who can fix it', async () => {
    const user = userEvent.setup();
    const rohan = mockApi.db.users.find((entry) => entry.email === 'priya@acmelabs.dev');
    if (rohan) rohan.status = 'deactivated';
    await renderPage(() => <Harness />, '/login', testQueryClient());
    await signIn(user, 'priya@acmelabs.dev', MOCK_PASSWORD);
    expect(await screen.findByText('Your Acme Labs account is turned off')).toBeTruthy();
    expect(screen.getByText(/Settings › People/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(screen.getByLabelText('Email')).toHaveProperty('value', '');
  });

  it('keeps what was typed while the server is down, and offers to try again', async () => {
    const user = userEvent.setup();
    mockApi.db.authDown = true;
    await renderPage(() => <Harness />, '/login', testQueryClient());
    await signIn(user, 'rohan@acmelabs.dev', MOCK_PASSWORD);
    expect(await screen.findByText('Can’t reach the Acme Labs server')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toHaveProperty('value', 'rohan@acmelabs.dev');
    mockApi.db.authDown = false;
    await user.click(screen.getByRole('button', { name: 'Try again now' }));
    expect(await screen.findByText('Signed in as Rohan S.')).toBeTruthy();
  });

  it('remembers the method and the person on this device after signing in', async () => {
    const user = userEvent.setup();
    await renderPage(() => <Harness />, '/login', testQueryClient());
    await signIn(user, 'rohan@acmelabs.dev', MOCK_PASSWORD);
    expect(await screen.findByText('Signed in as Rohan S.')).toBeTruthy();
    expect(readLastSignIn()).toEqual({
      method: 'password',
      providerId: null,
      email: 'rohan@acmelabs.dev',
      name: 'Rohan S.',
    });
  });
});
