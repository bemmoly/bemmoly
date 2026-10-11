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
  it('names the provider, starts it and shows that it is leaving', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<SsoButtons options={[option('a', 'Okta')]} onStart={onStart} only />);
    await user.click(screen.getByRole('button', { name: 'Continue with Okta' }));
    expect(onStart).toHaveBeenCalledWith('a');
    expect(screen.getByRole('button', { name: 'Opening Okta…' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('badges and focuses the provider this device used last', () => {
    render(
      <SsoButtons
        options={[option('a', 'Staff'), option('b', 'Contractors')]}
        onStart={() => undefined}
        lastUsedId="b"
        autoFocus
      />,
    );
    const last = screen.getByRole('button', { name: /Continue with Contractors/ });
    expect(last.textContent).toContain('Last used');
    expect(document.activeElement).toBe(last);
    expect(screen.getByRole('button', { name: 'Continue with Staff' })).toBeTruthy();
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
