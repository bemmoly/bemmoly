import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '../../../lib/api.ts';
import { seedAiOff } from '../../../mocks/seed/ai.ts';
import { renderPage, signedInClient } from '../../../test/render.tsx';
import { mockApi } from '../../../test/setup.ts';
import { AiSetupPage } from './ai-setup-page.tsx';

describe('AiSetupPage', () => {
  it('shows the switch, the connected provider and a model on every role', async () => {
    await renderPage(() => <AiSetupPage />);
    const toggle = await screen.findByRole('switch', { name: 'AI for this workspace' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    const table = await screen.findByRole('table', { name: 'Connected providers' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    for (const role of ['fast', 'standard', 'strong', 'embedding']) {
      const select = await screen.findByRole('combobox', { name: `Model for the ${role} role` });
      await waitFor(() => expect(select.textContent).not.toBe('Choose a model'));
    }
    expect(await screen.findByText(/Live · models\.dev/)).toBeTruthy();
  });

  it('folds everything but the switch away when AI is turned off', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiSetupPage />);
    await user.click(await screen.findByRole('switch', { name: 'AI for this workspace' }));
    await waitFor(() => expect(mockApi.db.ai.settings.privacy.enabled).toBe(false));
    expect(screen.queryByRole('table', { name: 'Connected providers' })).toBeNull();
    expect(screen.getByText(/Providers and roles are kept/)).toBeTruthy();
    expect(mockApi.db.ai.providers).toHaveLength(1);
    expect((await api.auth.me()).workspace.aiEnabled).toBe(false);
  });

  it('guides an admin through the first provider when AI was never set up', async () => {
    mockApi.db.ai = seedAiOff();
    const user = userEvent.setup();
    await renderPage(() => <AiSetupPage />, '/', await signedInClient());
    expect(await screen.findByRole('heading', { name: 'AI is off' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add provider…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a provider' });
    await user.click(await within(dialog).findByRole('radio', { name: /Local server/ }));
    const connect = await screen.findByRole('dialog', { name: 'Connect Local server' });
    await user.click(within(connect).getByRole('button', { name: 'Connect provider' }));
    expect(await within(connect).findByText(/Enter the address of your model server/)).toBeTruthy();
    await user.type(within(connect).getByLabelText('Base URL'), 'http://10.0.4.12:8000/v1');
    await user.click(within(connect).getByRole('button', { name: 'Test connection' }));
    expect(await within(connect).findByText(/3 models found/)).toBeTruthy();
    await user.click(within(connect).getByRole('button', { name: 'Connect provider' }));
    await waitFor(() => expect(mockApi.db.ai.providers).toHaveLength(1));
    // Connecting the first provider turns AI on and fills every role it can.
    await waitFor(() => expect(mockApi.db.ai.settings.privacy.enabled).toBe(true));
    await waitFor(() => expect(mockApi.db.ai.roles.embedding?.model).toBe('house-embed'));
    expect(mockApi.db.ai.roles.fast?.model).toMatch(/house-chat/);
  });

  it('reports a refused key in the provider’s own words', async () => {
    mockApi.db.ai = seedAiOff();
    const user = userEvent.setup();
    await renderPage(() => <AiSetupPage />, '/?add=local', await signedInClient());
    const connect = await screen.findByRole('dialog', { name: 'Connect Local server' });
    await user.type(within(connect).getByLabelText('Base URL'), 'http://10.0.4.12:8000/v1');
    await user.type(within(connect).getByLabelText('API key'), 'a-bad-key');
    await user.click(within(connect).getByRole('button', { name: 'Test connection' }));
    const alert = await within(connect).findByRole('alert');
    expect(alert.textContent).toContain('Incorrect API key provided.');
    expect(mockApi.db.ai.providers).toHaveLength(0);
  });

  it('assigns a role at once', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiSetupPage />);
    const select = await screen.findByRole('combobox', { name: 'Model for the fast role' });
    await waitFor(() => expect(select.textContent).not.toBe('Choose a model'));
    const before = mockApi.db.ai.roles.fast?.model;
    await user.click(select);
    const options = await screen.findAllByRole('option');
    const other = options.find(
      (option) => !option.textContent?.startsWith(select.textContent ?? ''),
    );
    await user.click(other as HTMLElement);
    await waitFor(() => expect(mockApi.db.ai.roles.fast?.model).not.toBe(before));
  });
});
