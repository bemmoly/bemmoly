import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SETUP_DRAFT, useSetupStore } from '../store/setup.ts';
import { renderQueryHook, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  presetIdFromSetting,
  THEME_CHOICES,
  themeSettingId,
  themeSettingValues,
  useSetupAppearance,
} from './use-setup-appearance.ts';
import { invitesLine, summaryRows, useSetupDone } from './use-setup-done.ts';
import { healthHeadline, healthRows, serverLabel, useSetupHealth } from './use-setup-health.ts';
import { importSummary } from './use-setup-import.ts';

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
});

describe('health checks', () => {
  const readiness = {
    status: 'ready' as const,
    checks: { database: { status: 'ok' as const, latencyMs: 12.4 } },
  };

  it('shows Postgres from /readyz and the rest as checked later', () => {
    const rows = healthRows({ readiness, system: undefined });
    expect(rows[0]).toMatchObject({ name: 'Postgres 18', status: 'ok', detail: '12 ms' });
    expect(rows.slice(1).map((row) => row.status)).toEqual(Array(5).fill('pending'));
    expect(healthHeadline(rows)).toBe('Bemmoly found a healthy Postgres.');
  });

  it('says why the database failed', () => {
    const failed = {
      status: 'unavailable' as const,
      checks: { database: { status: 'failed' as const, message: 'connection refused' } },
    };
    const rows = healthRows({ readiness: failed, system: undefined });
    expect(rows[0]).toMatchObject({ status: 'failed', detail: 'connection refused' });
    expect(healthHeadline(rows)).toContain('connection refused');
  });

  it('labels the server with or without a version', () => {
    expect(serverLabel('host:8080', '0.1.0')).toBe('host:8080 · v0.1.0 · self-hosted');
    expect(serverLabel('host:8080', undefined)).toBe('host:8080 · self-hosted');
  });

  it('uses only /readyz before anyone is signed in', async () => {
    mockApi.reset('fresh');
    const { result } = await renderQueryHook(() => useSetupHealth(false), testQueryClient());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0]?.detail).toBe('12 ms');
    expect(result.current.rows).toHaveLength(6);
    expect(result.current.serverLabel).toBe('bemmoly.test · self-hosted');
  });

  it('uses the full system checks for a signed-in admin', async () => {
    const { result } = await renderQueryHook(() => useSetupHealth(true));
    await waitFor(() => expect(result.current.rows[1]?.status).not.toBe('pending'));
    expect(result.current.rows.map((row) => row.id)).toEqual(
      mockApi.db.system.health.map((row) => row.id),
    );
    expect(result.current.serverLabel).toContain(`v${mockApi.db.system.version}`);
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
