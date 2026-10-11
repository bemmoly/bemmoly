import { SSO_FAILURE_REASONS } from '@bemmoly/shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SSO_FAILURE_COPY, ssoFailureMessage } from '../../hooks/use-sso-sign-in.ts';
import { SsoButtons } from './sso-buttons.tsx';

const option = (id: string, displayName: string) => ({
  id,
  displayName,
  protocol: 'oidc' as const,
  preset: null,
});

describe('SsoButtons', () => {
  it('says "Continue with SSO" for one provider and starts it', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<SsoButtons options={[option('a', 'Acme sign-in')]} onStart={onStart} primary />);
    await user.click(screen.getByRole('button', { name: 'Continue with SSO' }));
    expect(onStart).toHaveBeenCalledWith('a');
    expect(screen.getByText('Signs you in through Acme sign-in.')).toBeTruthy();
  });

  it('names each provider when there are several', () => {
    render(
      <SsoButtons
        options={[option('a', 'Staff'), option('b', 'Contractors')]}
        onStart={() => undefined}
        primary={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue with Staff' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Contractors' })).toBeTruthy();
  });
});

describe('sign-in failure copy', () => {
  it('explains every reason the server can send, and nothing else', () => {
    for (const reason of SSO_FAILURE_REASONS) {
      expect(ssoFailureMessage(reason)).toBe(SSO_FAILURE_COPY[reason]);
      expect(SSO_FAILURE_COPY[reason]).toMatch(/\.$/);
    }
    expect(ssoFailureMessage('<script>')).toBeNull();
    expect(ssoFailureMessage(undefined)).toBeNull();
  });
});
