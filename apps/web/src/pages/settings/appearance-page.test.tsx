import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { AppearancePage } from './appearance-page.tsx';

describe('AppearancePage', () => {
  it('previews a preset and saves it for the workspace', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const ocean = await screen.findByRole('radio', { name: /^Ocean/ });
    expect(screen.getByText('Classic preset')).toBeDefined();
    expect(screen.getByText(/Sets the default look for everyone in Acme Labs\./)).toBeDefined();

    act(() => fireEvent.click(ocean));
    expect(ocean.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Ocean preset')).toBeDefined();
    expect(screen.getByTestId('appearance-preview').dataset['theme']).toBe('ocean');
    expect(screen.getByText('Select "Custom" above to edit')).toBeDefined();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save for workspace' })));
    await waitFor(() => expect(mockApi.db.settings['appearance.theme']).toBe('ocean'));
    expect(mockApi.db.settings['appearance.font']).toBe('inter');
  });

  it('switches to Custom from a swatch and themes the preview with built tokens', async () => {
    await renderPage(() => <AppearancePage />, '/settings/appearance');
    const swatch = await screen.findByRole('radio', { name: '#e11d48' });
    act(() => fireEvent.click(swatch));
    expect(screen.getByRole('radio', { name: /^Custom/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByText('Custom · #e11d48 · light')).toBeDefined();
    const preview = screen.getByTestId('appearance-preview');
    expect(preview.style.getPropertyValue('--ac-fill')).not.toBe('');
    expect(screen.getByText(/White text on #e11d48/)).toBeDefined();
  });
});
