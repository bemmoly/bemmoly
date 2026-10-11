import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '../../lib/api.ts';
import { USER_IDS } from '../../mocks/seed/people.ts';
import { renderPage, signedInClient } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { ProfilePage } from './profile-page.tsx';

describe('ProfilePage, AI', () => {
  it('lets a member turn AI off for themselves, and aiEnabled follows', async () => {
    mockApi.reset('member');
    const user = userEvent.setup();
    await renderPage(() => <ProfilePage />, '/', await signedInClient());
    const toggle = await screen.findByRole('switch', { name: 'Use AI features' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(toggle);
    await waitFor(() => expect(mockApi.db.ai.optedOut).toContain(USER_IDS.aisha));
    expect((await api.auth.me()).workspace.aiEnabled).toBe(false);
  });

  it('shows no AI row when the admin keeps AI on for everyone', async () => {
    mockApi.reset('member');
    mockApi.db.ai.settings.privacy.perUserOptOutAllowed = false;
    await renderPage(() => <ProfilePage />, '/', await signedInClient());
    expect(await screen.findByText('Notifications')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('switch', { name: 'Use AI features' })).toBeNull(),
    );
  });

  it('shows no AI row while AI is off', async () => {
    mockApi.db.ai.settings.privacy.enabled = false;
    await renderPage(() => <ProfilePage />);
    expect(await screen.findByText('Notifications')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Use AI features' })).toBeNull();
  });
});
