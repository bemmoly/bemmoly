import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigation } from '../../hooks/use-oauth-consent.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { OAuthConsentPage } from './oauth-consent-page.tsx';

const REQUEST = {
  response_type: 'code',
  client_id: 'https://desk.example/oauth/client.json',
  redirect_uri: 'http://localhost:7123/callback',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  scope: 'mcp:read mcp:write',
  state: '12345',
  resource: 'http://localhost:5173/mcp',
};

const pathOf = (request: Record<string, string>) =>
  `/oauth/authorize?${new URLSearchParams(request).toString()}`;

beforeEach(() => {
  mockApi.db.settings['mcp.enabled'] = true;
});
afterEach(() => vi.restoreAllMocks());

describe('OAuthConsentPage', () => {
  it('names the app, where it sends you back and what it may do, then connects with less', async () => {
    const user = userEvent.setup();
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    await renderPage(() => <OAuthConsentPage />, pathOf(REQUEST));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connect Desk Assistant' }),
    ).toBeTruthy();
    const card = screen.getByRole('region', { name: 'The app asking for access' });
    expect(within(card).getByText('desk.example')).toBeTruthy();
    expect(within(card).getByText('localhost:7123')).toBeTruthy();
    expect(screen.getByText('This app runs on your computer')).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: /Read only/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Docs' }));
    await user.click(screen.getByRole('button', { name: 'Connect Desk Assistant' }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    const back = new URL(String(assign.mock.calls[0]?.[0]));
    expect(back.origin + back.pathname).toBe(REQUEST.redirect_uri);
    // A numeric state comes back exactly as the client sent it.
    expect(back.searchParams.get('state')).toBe('12345');
    expect(back.searchParams.get('code')).toMatch(/^mock-/);
    const grant = mockApi.db.oauthGrants?.[0];
    expect(grant?.access).toBe('read');
    expect(grant?.modules).toContain('work');
    expect(grant?.modules).not.toContain('docs');
  });

  it('needs at least one module, and sends access_denied when the person denies', async () => {
    const user = userEvent.setup();
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    await renderPage(() => <OAuthConsentPage />, pathOf(REQUEST));
    await screen.findByRole('heading', { level: 1, name: 'Connect Desk Assistant' });
    for (const box of screen.getAllByRole('checkbox')) await user.click(box);
    expect(screen.getByRole('alert').textContent).toBe('Choose at least one module.');
    const connect = screen.getByRole('button', { name: 'Connect Desk Assistant' });
    expect(connect.hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(String(assign.mock.calls[0]?.[0])).toContain('error=access_denied');
  });

  it('never offers to go back to an address the app did not register', async () => {
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    await renderPage(
      () => <OAuthConsentPage />,
      pathOf({ ...REQUEST, redirect_uri: 'https://evil.example/callback' }),
    );
    expect(await screen.findByText('This connection can’t continue')).toBeTruthy();
    expect(screen.getByText(/has not registered/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('says so when MCP is off, and returns a malformed request to the app', async () => {
    mockApi.db.settings['mcp.enabled'] = false;
    const first = await renderPage(() => <OAuthConsentPage />, pathOf(REQUEST));
    expect(await screen.findByText('Apps can’t connect right now')).toBeTruthy();
    first.unmount();

    mockApi.db.settings['mcp.enabled'] = true;
    const withoutPkce: Record<string, string> = { ...REQUEST };
    delete withoutPkce['code_challenge'];
    await renderPage(() => <OAuthConsentPage />, pathOf(withoutPkce));
    expect(await screen.findByText(/sent a request Bemmoly can’t use/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Desk Assistant' })).toBeTruthy();
  });
});
