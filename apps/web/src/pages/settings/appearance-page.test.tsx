import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiOf } from '../../mocks/routes/ai-state.ts';
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
  });

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
});
