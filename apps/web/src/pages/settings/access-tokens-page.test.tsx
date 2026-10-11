import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toCreateInput } from '../../hooks/use-api-tokens.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { AccessTokensPage } from './access-tokens-page.tsx';

describe('AccessTokensPage', () => {
  it('starts empty with one action to create a token', async () => {
    await renderPage(() => <AccessTokensPage />);
    expect(await screen.findByText('No access tokens yet')).toBeTruthy();
  });

  it('creates a module-scoped token and shows its secret once', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AccessTokensPage />);
    await user.click((await screen.findAllByRole('button', { name: 'Create token' }))[0]!);
    const dialog = () => within(screen.getByRole('dialog'));
    await user.click(dialog().getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText(/Give the token a name/)).toBeTruthy();

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Laptop editor');
    await user.click(screen.getByRole('radio', { name: 'Read and write' }));
    await user.click(screen.getByRole('radio', { name: 'Only these modules' }));
    await user.click(screen.getByRole('checkbox', { name: 'Work' }));
    await user.click(dialog().getByRole('button', { name: 'Create token' }));

    const secret = await screen.findByLabelText('Access token');
    expect(secret.textContent).toMatch(/^bmly_/);
    expect(screen.getByText(/won’t be shown again/)).toBeTruthy();
    const stored = mockApi.db.apiTokens[0]!;
    expect(stored).toMatchObject({ name: 'Laptop editor', scopes: ['read', 'write'] });
    expect(stored.modules).toEqual(['work']);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('Access token')).toBeNull();
    const table = await screen.findByRole('table', { name: 'Access tokens' });
    expect(within(table).getByText('Laptop editor')).toBeTruthy();
    expect(within(table).getByText('Read and write')).toBeTruthy();
    expect(within(table).queryByText(secret.textContent ?? '')).toBeNull();
  });

  it('revokes a token after confirmation', async () => {
    mockApi.db.apiTokens = [
      {
        id: '01900000-0000-7000-8000-000000000001',
        name: 'Old script',
        prefix: 'bmly_abc1234',
        scopes: ['read'],
        modules: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ];
    const user = userEvent.setup();
    await renderPage(() => <AccessTokensPage />);
    expect(await screen.findByText('All modules')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Revoke Old script' }));
    await user.click(screen.getByRole('button', { name: 'Revoke token' }));
    await waitFor(() => expect(mockApi.db.apiTokens).toHaveLength(0));
    expect(await screen.findByText('No access tokens yet')).toBeTruthy();
  });

  it('turns the form into the create request', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const base = { name: ' CI ', access: 'read', allModules: true, modules: [] } as const;
    expect(toCreateInput({ ...base, expiry: 'never', modules: [] }, now)).toEqual({
      name: 'CI',
      scopes: ['read'],
      expiresAt: null,
      modules: null,
    });
    expect(toCreateInput({ ...base, expiry: '30', modules: [] }, now).expiresAt).toBe(
      '2026-01-31T00:00:00.000Z',
    );
  });
});
