import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SETUP_DRAFT, useSetupStore } from '../store/setup.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  CUSTOM_THEME_TOGGLE,
  presetIdFromSetting,
  THEME_CHOICES,
  themeSettingId,
  themeSettingValues,
  themeSummary,
  useSetupAppearance,
} from './use-setup-appearance.ts';
import { invitesLine, summaryRows, useSetupDone } from './use-setup-done.ts';
import { importSummary } from './use-setup-import.ts';
import { workspaceQuery } from './use-workspace.ts';

const preview = () => useThemePreviewStore.getState().preview;

beforeEach(() => useSetupStore.getState().reset());

describe('appearance step', () => {
  it('writes the server id for Classic and the token id for the rest', () => {
    expect(THEME_CHOICES).toHaveLength(8);
    expect(themeSettingId('light')).toBe('classic');
    expect(themeSettingId('warm')).toBe('warm');
    expect(presetIdFromSetting('classic')).toBe('light');
    expect(presetIdFromSetting('rose')).toBe('rose');
    expect(presetIdFromSetting('custom')).toBe('light');
    expect(themeSettingValues('warm')).toEqual({
      'appearance.theme': 'warm',
      'appearance.font': 'source',
    });
  });

  it('saves the picked preset and its font on Finish setup', async () => {
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAppearance(onSaved));
    act(() => result.current.select('midnight'));
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings['appearance.theme']).toBe('midnight');
    expect(mockApi.db.settings['appearance.font']).toBe('geist');
    expect(useSetupStore.getState().themeSaved).toBe(true);
  });

  it('previews the picked preset on the whole page and drops it on leaving', async () => {
    const { result, unmount } = await renderQueryHook(() => useSetupAppearance(vi.fn()));
    expect(preview()).toMatchObject({ kind: 'preset', id: 'light' });
    act(() => result.current.select('ocean'));
    expect(preview()).toMatchObject({ kind: 'preset', id: 'ocean', mode: 'dark' });
    unmount();
    expect(preview()).toBeNull();
    expect(mockApi.db.settings['appearance.theme']).not.toBe('ocean');
  });

  it('builds a custom theme in place, previews it and saves it on Finish setup', async () => {
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAppearance(onSaved));
    expect(result.current.toggleLabel).toBe(CUSTOM_THEME_TOGGLE.open);
    act(() => result.current.toggleCustom());
    expect(result.current.customOpen).toBe(true);
    expect(result.current.selected).toBeNull();
    expect(result.current.toggleLabel).toBe(CUSTOM_THEME_TOGGLE.close);
    act(() => result.current.custom.hex.onChange('7C3AED'));
    act(() => result.current.custom.setMode('dark'));
    act(() => result.current.custom.setFont('geist'));
    expect(preview()).toMatchObject({ kind: 'custom', mode: 'dark' });
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.theme': 'custom',
      'appearance.brandColor': '#7c3aed',
      'appearance.mode': 'dark',
      'appearance.surfaces': 'neutral',
      'appearance.font': 'geist',
    });
    const { theme, themeSaved, customTheme } = useSetupStore.getState();
    expect(themeSummary(theme, themeSaved, customTheme)).toBe(
      'Custom · #7c3aed · dark · members may switch light/dark',
    );
  });

  it('closes the builder and previews the preset when a tile is picked again', async () => {
    const { result } = await renderQueryHook(() => useSetupAppearance(vi.fn()));
    act(() => result.current.toggleCustom());
    act(() => result.current.custom.pickBrand('#0f766e'));
    act(() => result.current.select('warm'));
    expect(result.current.customOpen).toBe(false);
    expect(result.current.selected).toBe('warm');
    expect(preview()).toMatchObject({ kind: 'preset', id: 'warm' });
    act(() => result.current.toggleCustom());
    expect(result.current.custom.value.brand).toBe('#0f766e');
  });

  it('hands over from the preview to the saved workspace look on Finish setup', async () => {
    let shownOnSave: unknown = 'not saved';
    const onSaved = vi.fn(() => {
      shownOnSave = preview();
    });
    const { result, queryClient } = await renderQueryHook(() => useSetupAppearance(onSaved));
    act(() => result.current.select('forest'));
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(shownOnSave).toBeNull();
    expect(queryClient.getQueryData(workspaceQuery.queryKey)?.appearance.preset).toBe('forest');
  });
});

describe('summary', () => {
  it('describes what actually happened', () => {
    const rows = summaryRows({
      workspaceName: 'Acme Labs',
      workspaceUrl: 'https://bemmoly.acme.test',
      adminEmail: 'rohan@acme.test',
      draft: { ...INITIAL_SETUP_DRAFT, importSource: 'csv', invitesSent: 3 },
      providerName: null,
    });
    expect(Object.fromEntries(rows.map((row) => [row.key, row.value]))).toEqual({
      workspace: 'Acme Labs · bemmoly.acme.test',
      admin: 'rohan@acme.test (break-glass password set)',
      import: 'CSV or Linear / Trello / Asana export (importers arrive in a later release)',
      signIn: 'Password · 3 invites sent',
      ai: 'Skipped · connect a provider any time in Settings',
      theme: 'Skipped · the default theme stays',
    });
    expect(rows.filter((row) => !row.done).map((row) => row.key)).toEqual(['ai', 'theme']);
    expect(importSummary(null)).toBe('Skipped');
    expect(invitesLine(1)).toBe('1 invite sent');
  });

  it('marks setup finished once on arrival', async () => {
    mockApi.reset('wizard');
    useSetupStore.getState().update({ themeSaved: true, theme: 'forest' });
    const { result } = await renderQueryHook(() => useSetupDone());
    await waitFor(() => expect(result.current.complete.isSuccess).toBe(true));
    expect(typeof mockApi.db.settings['setup.completedAt']).toBe('string');
    await waitFor(() => expect(result.current.loading).toBe(false));
    const theme = result.current.rows.find((row) => row.key === 'theme');
    expect(theme?.value).toBe('Forest · members may switch light/dark');
    expect(result.current.rows[0]?.value).toContain('Acme Labs');
    act(() => result.current.leave());
    expect(useSetupStore.getState().theme).toBe(INITIAL_SETUP_DRAFT.theme);
  });
});
