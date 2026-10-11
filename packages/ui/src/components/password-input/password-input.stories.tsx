import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Field } from '../input/field.tsx';
import { PasswordInput } from './password-input.tsx';

const meta = {
  title: 'Components/PasswordInput',
  component: PasswordInput,
  args: { autoComplete: 'current-password' },
} satisfies Meta<typeof PasswordInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Sign-in: fills a saved password; press Caps Lock while focused to see the hint. */
export const SignIn: Story = {
  render: () => (
    <div className="flex w-95 flex-col gap-4 rounded-card border border-line bg-card p-5">
      <Field label="Password">
        <PasswordInput autoComplete="current-password" defaultValue="correct horse" />
      </Field>
      <Field label="Password" error="That email and password don’t match.">
        <PasswordInput autoComplete="current-password" defaultValue="wrong" />
      </Field>
      <Field label="Password">
        <PasswordInput autoComplete="current-password" defaultValue="signing in" readOnly />
      </Field>
    </div>
  ),
};

function NewPassword() {
  const [value, setValue] = useState('violet staircase 42');
  return (
    <Field label="New password">
      <PasswordInput
        autoComplete="new-password"
        meter
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Field>
  );
}

/** Reset and invitation: offers to save a new password, with the strength meter. */
export const NewWithMeter: Story = {
  render: () => (
    <div className="flex w-95 flex-col gap-4 rounded-card border border-line bg-card p-5">
      <NewPassword />
    </div>
  ),
};
