import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderQueryHook, signedInClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { HEX_ERROR } from './use-appearance-draft.ts';
import { useAppearance } from './use-appearance.ts';
import { useWorkspace } from './use-workspace.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';

const preview = () => useThemePreviewStore.getState().preview;

describe('useAppearance', () => {
  it('loads the stored Classic preset for an admin', async () => {
    const { result } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    expect(result.current.canManage).toBe(true);
    expect(result.current.value?.preset).toBe('light');
    expect(result.current.preview.label).toBe('Classic preset');
    expect(result.current.draft.dirty).toBe(false);
  });

  it('reports a bad hex without touching the brand, then selects Custom on a good one', async () => {
    const { result } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    act(() => result.current.hex.onChange('#12'));
    expect(result.current.hex.error).toBe(HEX_ERROR);
    expect(result.current.value?.preset).toBe('light');
    act(() => result.current.hex.onChange('#E11D48'));
    expect(result.current.hex.error).toBeNull();
    expect(result.current.value).toMatchObject({ preset: 'custom', brand: '#e11d48' });
    expect(result.current.preview.label).toBe('Custom · #e11d48 · light');
  });

  it('saves a custom theme and the policy for the workspace', async () => {
    const { result, queryClient } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    act(() => result.current.pickBrand('#7c3aed'));
    act(() => result.current.setMode('dark'));
    act(() => result.current.setPolicy({ personalThemes: true }));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.theme': 'custom',
      'appearance.brandColor': '#7c3aed',
      'appearance.mode': 'dark',
      'appearance.personalThemes': true,
    });
    await waitFor(() => expect(result.current.draft.dirty).toBe(false));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('previews a picked preset on the whole page until Discard', async () => {
    const { result } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    expect(preview()).toBeNull();
    act(() => result.current.selectTheme('midnight'));
    expect(preview()).toMatchObject({ kind: 'preset', id: 'midnight', mode: 'dark' });
    act(() => result.current.pickBrand('#7c3aed'));
    expect(preview()).toMatchObject({ kind: 'custom', mode: 'light' });
    act(() => result.current.discard());
    expect(preview()).toBeNull();
  });

  it('drops the preview once the saved look is loaded, and on leaving the page', async () => {
    const { result, queryClient, unmount } = await renderQueryHook(() => ({
      appearance: useAppearance(),
      workspace: useWorkspace(),
    }));
    await waitFor(() => expect(result.current.appearance.value).toBeDefined());
    act(() => result.current.appearance.selectTheme('forest'));
    act(() => result.current.appearance.submit());
    await waitFor(() => expect(preview()).toBeNull());
    expect(result.current.workspace.appearance.preset).toBe('forest');
    act(() => result.current.appearance.selectTheme('rose'));
    expect(preview()).toMatchObject({ id: 'rose' });
    unmount();
    expect(preview()).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('writes Classic back as "classic"', async () => {
    mockApi.db.settings['appearance.theme'] = 'ocean';
    const { result, queryClient } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value?.preset).toBe('ocean'));
    act(() => result.current.selectTheme('light'));
    act(() => result.current.submit());
    await waitFor(() => expect(mockApi.db.settings['appearance.theme']).toBe('classic'));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('does not save for someone without the appearance capability', async () => {
    mockApi.reset('member');
    const { result } = await renderQueryHook(() => useAppearance(), await signedInClient());
    expect(result.current.canManage).toBe(false);
    act(() => result.current.submit());
    expect(result.current.settings.save.isIdle).toBe(true);
    await waitFor(() => expect(result.current.settings.isError).toBe(true));
  });
});
