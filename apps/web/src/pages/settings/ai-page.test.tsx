import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderPage, signedInClient } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { AiPage } from './ai-page.tsx';

describe('AiPage', () => {
  it('saves a provider picked from the full list', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiPage />);
    const list = await screen.findByRole('radiogroup', { name: 'All providers' });
    await user.type(screen.getByLabelText('Search providers'), 'openrouter');
    await user.click(within(list).getByRole('radio', { name: /OpenRouter/ }));
    expect(await screen.findByText('Connect OpenRouter')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockApi.db.settings['ai.providerId']).toBe('openrouter'));
  });

  it('shows the controls off for someone who cannot configure models', async () => {
    mockApi.reset('member');
    await renderPage(() => <AiPage />, '/', await signedInClient());
    expect(await screen.findByText(/Only people who can configure AI models/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
  });
});
