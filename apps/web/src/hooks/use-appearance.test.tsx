import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { renderQueryHook, signedInClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { useAppearance } from './use-appearance.ts';
import { useWorkspace } from './use-workspace.ts';

const preview = () => useThemePreviewStore.getState().preview;

describe('useAppearance', () => {
  it('loads the stored theme, default mode and typeface for an admin', async () => {
    const { result } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    expect(result.current.canManage).toBe(true);
    expect(result.current.value).toEqual({
      theme: 'bemmoly',
      defaultMode: 'light',
      font: 'plex',
      personalThemes: false,
    });
    expect(result.current.options.map((option) => option.ref)).toEqual([
      'bemmoly',
      'graphite',
      'sand',
      'pine',
      'contrast',
    ]);
    expect(result.current.draft.dirty).toBe(false);
  });

  it('saves the theme, default mode, typeface and policy for the workspace', async () => {
    const { result, queryClient } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value).toBeDefined());
    act(() => result.current.update({ theme: 'pine', defaultMode: 'system', font: 'inter' }));
    act(() => result.current.update({ personalThemes: true }));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.theme': 'pine',
      'appearance.customThemeId': null,
      'appearance.defaultMode': 'system',
      'appearance.font': 'inter',
      'appearance.personalThemes': true,
    });
    await waitFor(() => expect(result.current.draft.dirty).toBe(false));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('makes a workspace custom theme the default and mirrors its brand', async () => {
    mockApi.db.customThemes.push({
      id: '0199c0de-0000-7000-8000-00000000a001',
      name: 'Acme',
      brandColor: '#0f766e',
      surface: 'neutral',
      scope: 'workspace',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ownerId: null,
    });
    const { result, queryClient } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.options).toHaveLength(6));
    act(() => result.current.update({ theme: 'custom:0199c0de-0000-7000-8000-00000000a001' }));
    expect(preview()?.source?.name).toBe('Acme');
    act(() => result.current.submit());
    await waitFor(() => expect(mockApi.db.settings['appearance.theme']).toBe('custom'));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.customThemeId': '0199c0de-0000-7000-8000-00000000a001',
      'appearance.brandColor': '#0f766e',
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('previews a picked theme on the whole page until Discard, and drops it on leaving', async () => {
    const { result, queryClient, unmount } = await renderQueryHook(() => ({
      appearance: useAppearance(),
      workspace: useWorkspace(),
    }));
    await waitFor(() => expect(result.current.appearance.value).toBeDefined());
    expect(preview()).toBeNull();
    act(() => result.current.appearance.update({ theme: 'graphite' }));
    expect(preview()?.source?.id).toBe('graphite');
    act(() => result.current.appearance.discard());
    expect(preview()).toBeNull();
    act(() => result.current.appearance.update({ theme: 'sand' }));
    act(() => result.current.appearance.submit());
    await waitFor(() => expect(preview()).toBeNull());
    expect(result.current.workspace.appearance.theme).toBe('sand');
    act(() => result.current.appearance.update({ theme: 'contrast' }));
    unmount();
    expect(preview()).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('reads a retired preset still stored as its theme', async () => {
    mockApi.db.settings['appearance.theme'] = 'forest';
    const { result } = await renderQueryHook(() => useAppearance());
    await waitFor(() => expect(result.current.value?.theme).toBe('pine'));
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
