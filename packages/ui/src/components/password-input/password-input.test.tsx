import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible, expectFocusRing } from '../../testing/a11y.ts';
import { Field } from '../input/field.tsx';
import { PasswordInput } from './password-input.tsx';
import { passwordStrength } from './strength.ts';

describe('PasswordInput', () => {
  it('names itself for password managers and passes axe', async () => {
    const { container } = render(
      <Field label="Password" error="That email and password don’t match.">
        <PasswordInput autoComplete="current-password" defaultValue="secret" />
      </Field>,
    );
    await expectAccessible(container);
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('name')).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText('That email and password don’t match.');
    expect(input.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('shows and hides the password with a pressed toggle', () => {
    render(
      <Field label="Password">
        <PasswordInput autoComplete="current-password" defaultValue="secret" />
      </Field>,
    );
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expectFocusRing(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');
  });

  it('says when Caps Lock is on, and describes the field with it', () => {
    render(
      <Field label="Password">
        <PasswordInput autoComplete="current-password" />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    fireEvent.keyDown(input, { key: 'A', modifierCapsLock: true });
    const hint = screen.getByText('Caps Lock is on');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    fireEvent.blur(input);
    expect(screen.queryByText('Caps Lock is on')).toBeNull();
  });

  it('draws the strength meter for a new password', async () => {
    const { container } = render(
      <Field label="New password">
        <PasswordInput autoComplete="new-password" meter defaultValue="violet staircase 42" />
      </Field>,
    );
    await expectAccessible(container);
    expect(screen.getByLabelText('New password').getAttribute('autocomplete')).toBe(
      'new-password',
    );
    expect(screen.getByText(/Strength:/).textContent).toMatch(/strong/);
  });
});

describe('passwordStrength', () => {
  it('is zero under the minimum and grows with length and variety', () => {
    expect(passwordStrength('short', 12)).toBe(0);
    expect(passwordStrength('aaaaaaaaaaaa', 12)).toBe(1);
    expect(passwordStrength('abcdefghijkl', 12)).toBe(1);
    expect(passwordStrength('Abcdefghijk1', 12)).toBe(2);
    expect(passwordStrength('violet staircase 42', 12)).toBe(3);
    expect(passwordStrength('a much longer violet staircase 42', 12)).toBe(4);
  });
});
