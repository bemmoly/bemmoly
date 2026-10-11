import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mcpSnippet } from '../../hooks/use-mcp-settings.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { McpPage } from './mcp-page.tsx';

describe('McpPage', () => {
  it('is off by default and turns on at once', async () => {
    const user = userEvent.setup();
    await renderPage(() => <McpPage />);
    const toggle = await screen.findByRole('switch', { name: 'Allow MCP clients' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.click(toggle);
    await waitFor(() => expect(mockApi.db.settings['mcp.enabled']).toBe(true));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('exposes every module until a subset is chosen', async () => {
    const user = userEvent.setup();
    await renderPage(() => <McpPage />);
    const all = await screen.findByRole('radio', { name: /Every enabled module/ });
    expect((all as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Only the modules chosen below' }));
    const chosen = () => mockApi.db.settings['mcp.modules'] as string[] | undefined;
    await waitFor(() => expect(chosen()).toEqual(expect.arrayContaining(['work', 'docs'])));
    await user.click(await screen.findByRole('switch', { name: 'Expose Docs' }));
    await waitFor(() => expect(chosen()).not.toContain('docs'));
    expect(chosen()).toContain('work');
    expect(screen.queryByLabelText('Docs endpoint')).toBeNull();
    expect(screen.getByLabelText('Work endpoint').textContent).toBe(
      `${window.location.origin}/mcp/work`,
    );
  });

  it('shows a sign-in configuration with no token, and a token one for headless clients', async () => {
    await renderPage(() => <McpPage />);
    const url = `${window.location.origin}/mcp`;
    expect((await screen.findByLabelText('Endpoint')).textContent).toBe(url);
    type Config = { mcpServers: { bemmoly: { url: string; headers?: Record<string, string> } } };
    const signIn = screen.getByLabelText('Client configuration').textContent ?? '';
    expect(signIn).toBe(mcpSnippet(url));
    const parsed = JSON.parse(signIn) as Config;
    expect(parsed.mcpServers.bemmoly.url).toBe(url);
    expect(parsed.mcpServers.bemmoly.headers).toBeUndefined();
    const token = JSON.parse(
      screen.getByLabelText('Token configuration').textContent ?? '',
    ) as Config;
    expect(token.mcpServers.bemmoly.headers?.['Authorization']).toBe('Bearer <your token>');
    expect(screen.getByRole('link', { name: 'access tokens' }).getAttribute('href')).toBe(
      '/settings/access-tokens',
    );
  });
});
