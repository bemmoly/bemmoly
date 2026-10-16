import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_DEVICE_CODE } from '../../mocks/routes/oauth-device.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { DeviceSignInPage } from './device-sign-in-page.tsx';

describe('DeviceSignInPage', () => {
  it('takes a typed code in any form, names the tool and approves it', async () => {
    const user = userEvent.setup();
    await renderPage(() => <DeviceSignInPage />, '/device');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in on a device' }),
    ).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Code' }), 'wdjb mjht');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('bp on build-box')).toBeTruthy();
    expect(screen.getByText(/asks to act as you in pipelines, for 90 days/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Approve sign-in' }));
    expect(await screen.findByText('bp on build-box is signed in')).toBeTruthy();
    await waitFor(() =>
      expect(mockApi.db.audit.some((entry) => entry.action === 'oauth.device_approved')).toBe(true),
    );
  });

  it('says what is wrong with a short code before asking the server', async () => {
    const user = userEvent.setup();
    await renderPage(() => <DeviceSignInPage />, '/device');
    await user.type(await screen.findByRole('textbox', { name: 'Code' }), 'WDJB');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Codes have eight letters, like WDJB-MJHT.',
    );
  });

  it('reads the code from the link and lets the person deny it', async () => {
    const user = userEvent.setup();
    await renderPage(() => <DeviceSignInPage />, `/device?code=${MOCK_DEVICE_CODE}`);
    await user.click(await screen.findByRole('button', { name: 'Deny' }));
    expect(await screen.findByText('Sign-in refused')).toBeTruthy();
  });

  it('explains an unknown or expired code and offers another', async () => {
    await renderPage(() => <DeviceSignInPage />, '/device?code=BCDF-GHJK');
    expect(await screen.findByText(/That code is not valid or has expired/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use another code' })).toBeTruthy();
  });
});
