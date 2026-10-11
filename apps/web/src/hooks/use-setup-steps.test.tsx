import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SETUP_DRAFT, useSetupStore } from '../store/setup.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { SETUP_THEMES, themeSummary, useSetupAppearance } from './use-setup-appearance.ts';
import { invitesLine, summaryRows, useSetupDone } from './use-setup-done.ts';
import { importSummary } from './use-setup-import.ts';
import { workspaceQuery } from './use-workspace.ts';

const preview = () => useThemePreviewStore.getState().preview;

beforeEach(() => useSetupStore.getState().reset());

describe('appearance step', () => {
  it('offers the five themes and starts on Bemmoly, following the device', () => {
    expect(SETUP_THEMES.map((theme) => theme.id)).toEqual([
      'bemmoly',
      'graphite',
      'sand',
      'pine',
      'contrast',
    ]);
    expect(INITIAL_SETUP_DRAFT).toMatchObject({ theme: 'bemmoly', defaultMode: 'system' });
  });

  it('saves the picked theme and default mode on Finish setup', async () => {
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAppearance(onSaved));
    act(() => result.current.select('pine'));
    act(() => result.current.setMode('dark'));
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings).toMatchObject({
      'appearance.theme': 'pine',
      'appearance.customThemeId': null,
      'appearance.defaultMode': 'dark',
    });
    expect(useSetupStore.getState().themeSaved).toBe(true);
  });

  it('previews the picked theme and mode on the whole page and drops it on leaving', async () => {
    const { result, unmount } = await renderQueryHook(() => useSetupAppearance(vi.fn()));
    expect(preview()).toMatchObject({ mode: 'system' });
    expect(preview()?.source?.id).toBe('bemmoly');
    act(() => result.current.select('graphite'));
    act(() => result.current.setMode('dark'));
    expect(preview()).toMatchObject({ mode: 'dark' });
    expect(preview()?.source?.id).toBe('graphite');
    unmount();
    expect(preview()).toBeNull();
    expect(mockApi.db.settings['appearance.theme']).not.toBe('graphite');
  });

  it('turns a typed brand colour into the workspace custom theme on Finish setup', async () => {
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAppearance(onSaved));
    act(() => result.current.hex.onChange('#12'));
    expect(result.current.hex.error).not.toBeNull();
    expect(result.current.custom).toBe(false);
    act(() => result.current.hex.onChange('0F766E'));
    expect(result.current.custom).toBe(true);
    expect(result.current.selected).toBeNull();
    expect(preview()?.source?.light.acc).toBe('#0f766e');
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [created] = mockApi.db.customThemes;
    expect(created).toMatchObject({ brandColor: '#0f766e', scope: 'workspace' });
    expect(mockApi.db.settings).toMatchObject({
      'appearance.theme': 'custom',
      'appearance.customThemeId': created?.id,
      'appearance.brandColor': '#0f766e',
    });
    const { theme, themeSaved, brand, defaultMode } = useSetupStore.getState();
    expect(themeSummary(theme, themeSaved, brand, defaultMode)).toBe(
      'Your brand colour · #0f766e · Match system by default',
    );
  });

  it('hands over from the preview to the saved workspace look on Finish setup', async () => {
    let shownOnSave: unknown = 'not saved';
    const onSaved = vi.fn(() => {
      shownOnSave = preview();
    });
    const { result, queryClient } = await renderQueryHook(() => useSetupAppearance(onSaved));
    act(() => result.current.select('sand'));
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(shownOnSave).toBeNull();
    expect(queryClient.getQueryData(workspaceQuery.queryKey)?.appearance.theme).toBe('sand');
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
      import: 'CSV file (report in Settings › Import)',
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
    useSetupStore.getState().update({ themeSaved: true, theme: 'pine' });
    const { result } = await renderQueryHook(() => useSetupDone());
    await waitFor(() => expect(result.current.complete.isSuccess).toBe(true));
    expect(typeof mockApi.db.settings['setup.completedAt']).toBe('string');
    await waitFor(() => expect(result.current.loading).toBe(false));
    const theme = result.current.rows.find((row) => row.key === 'theme');
    expect(theme?.value).toBe('Pine · Match system by default');
    expect(result.current.rows[0]?.value).toContain('Acme Labs');
    act(() => result.current.leave());
    expect(useSetupStore.getState().theme).toBe(INITIAL_SETUP_DRAFT.theme);
  });
});
