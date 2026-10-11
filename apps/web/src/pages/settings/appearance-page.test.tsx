import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiOf } from '../../mocks/routes/ai-state.ts';
import { seedAcmeLogo } from '../../mocks/seed/logo.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { AppearancePage } from './appearance-page.tsx';

describe('AppearancePage', () => {
  it('previews a theme in both modes and saves it with the default mode for the workspace', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const pine = await screen.findByRole('radio', { name: 'Pine' });
    expect(screen.getByText(/The default look for everyone in Acme Labs\./)).toBeDefined();
    expect(screen.getByText('Bemmoly, both modes')).toBeDefined();

    act(() => fireEvent.click(pine));
    expect(pine.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Pine, both modes')).toBeDefined();
    expect(screen.getByTestId('appearance-preview-light').dataset).toMatchObject({
      theme: 'pine',
      mode: 'light',
    });
    expect(screen.getByTestId('appearance-preview-dark').dataset['mode']).toBe('dark');

    const mode = screen.getByRole('radiogroup', { name: 'Default mode' });
    act(() => fireEvent.click(within(mode).getByRole('radio', { name: /Match system/ })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Geist' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save for workspace' })));
    await waitFor(() => expect(mockApi.db.settings['appearance.theme']).toBe('pine'));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.defaultMode': 'system',
      'appearance.font': 'geist',
    });
    // Renders both previews and saves; slow on shared CI runners.
  }, 20_000);

  it('offers a brand colour tile that opens the custom theme editor', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    expect(await screen.findByText('Your brand colour')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add brand colour' })).toBeDefined();
  });

  it('previews the AI risk bar and TL;DR only while AI is on', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const preview = await screen.findByTestId('appearance-preview-light');
    await waitFor(() => expect(preview.textContent).toContain('Sprint risk'));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Doc' })));
    expect(preview.textContent).toContain('TL;DR');
  });

  it('explains a wrong logo file before sending it, and says "on Bemmoly" stays', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    expect(await screen.findByText(/“on Bemmoly” always stays under it/)).toBeDefined();
    expect(screen.getByRole('img', { name: 'Sidebar preview: the Bemmoly lockup' })).toBeDefined();
    const input = screen.getByLabelText('Logo', { selector: 'input' });
    const gif = new File([new Uint8Array(8)], 'cat.gif', { type: 'image/gif' });
    act(() => fireEvent.change(input, { target: { files: [gif] } }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/cat\.gif is not a PNG/);
    expect(mockApi.db.settings['appearance.logoKey']).toBe('');
  });

  it('previews the uploaded logo in the sidebar and rail, and removes it', async () => {
    seedAcmeLogo(mockApi.db);
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const light = await screen.findByTestId('logo-preview-light');
    expect(light.textContent).toMatch(/on\s+Bemmoly/);
    expect(light.querySelectorAll('img[src^="data:image/svg+xml"]').length).toBe(2);
    expect(screen.getByTestId('logo-preview-dark').dataset['mode']).toBe('dark');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove' })));
    await waitFor(() => expect(mockApi.db.settings['appearance.logoKey']).toBe(''));
    await screen.findByRole('button', { name: 'Upload logo' });
  });

  it('draws no AI sample in the preview while AI is off', async () => {
    aiOf(mockApi.db).settings.privacy.enabled = false;
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const preview = await screen.findByTestId('appearance-preview-light');
    await screen.findByRole('radio', { name: 'Pine' });
    expect(preview.textContent).not.toContain('Sprint risk');
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Doc' })));
    expect(preview.textContent).toContain('Auth service RFC');
    expect(preview.textContent).not.toContain('TL;DR');
    expect(preview.innerHTML).not.toMatch(/-ai(-\d+)?\b/);
  });

  it('shows a member the workspace theme read-only and lets them choose only their mode', async () => {
    mockApi.db.signedInAs = mockApi.db.users.find((user) => user.name.startsWith('Jonas'))!.id;
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    expect(await screen.findByText('Your workspace admin sets the theme.')).toBeDefined();
    const theme = screen.getByRole('radio', { name: 'Bemmoly' });
    expect(theme.getAttribute('aria-checked')).toBe('true');
    expect(theme.closest('fieldset')?.disabled).toBe(true);
    expect(screen.queryByRole('radio', { name: 'Pine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save for workspace' })).toBeNull();

    const mode = screen.getByRole('radiogroup', { name: 'Your mode' });
    act(() => fireEvent.click(within(mode).getByRole('radio', { name: /Dark/ })));
    await waitFor(() =>
      expect(mockApi.db.appearancePreferences[mockApi.db.signedInAs!]?.mode).toBe('dark'),
    );
  });
});
