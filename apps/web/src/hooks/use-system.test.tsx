import type { Backup } from '@bemmoly/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemPage } from '../pages/settings/system-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { maintenanceOf } from './use-system-maintenance.ts';
import { checkTone, formatUptime, lastBackupLine, useSystem } from './use-system.ts';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const backup = (patch: Partial<Backup>): Backup => ({
  id: 'b',
  kind: 'scheduled',
  status: 'succeeded',
  createdAt: '2026-10-07T04:58:00.000Z',
  completedAt: '2026-10-07T05:00:00.000Z',
  appVersion: '0.1.1',
  changelogTag: null,
  sizeBytes: 412_000_000,
  attachmentMode: 'full',
  baseBackupId: null,
  encrypted: false,
  locations: [],
  verification: { state: 'restored', checkedAt: null, message: null },
  error: null,
  ...patch,
});

describe('system status', () => {
  it('maps checks to circle tones and formats uptime', () => {
    expect(checkTone('ok')).toBe('ok');
    expect(checkTone('warn')).toBe('caution');
    expect(checkTone('fail')).toBe('danger');
    expect(formatUptime(3 * 86_400 + 4 * 3_600)).toBe('3 days 4 hours');
    expect(formatUptime(3_600 + 60)).toBe('1 hour 1 minute');
    expect(formatUptime(40 * 60)).toBe('40 minutes');
  });

  it('flags a missing, failed or stale last backup', () => {
    expect(lastBackupLine(undefined, NOW).tone).toBe('caution');
    expect(lastBackupLine(backup({}), NOW)).toMatchObject({ tone: 'ok' });
    expect(lastBackupLine(backup({}), NOW).text).toMatch(/verified · 412 MB$/);
    expect(lastBackupLine(backup({ status: 'failed' }), NOW).tone).toBe('danger');
    const old = backup({ completedAt: '2026-10-05T05:00:00.000Z' });
    expect(lastBackupLine(old, NOW).tone).toBe('caution');
  });

  it('reads maintenance from the server, or from a refused write until then', () => {
    expect(maintenanceOf({ active: true, reason: 'Restoring…' }, [])).toMatchObject({
      active: true,
      message: 'Restoring…',
      poll: 3000,
    });
    expect(maintenanceOf({ active: false, reason: null }, []).poll).toBe(false);
  });

  it('loads the checks and the newest backup', async () => {
    const { result } = await renderQueryHook(() => useSystem());
    await waitFor(() => expect(result.current.lastBackup).not.toBeNull());
    expect(result.current.status?.checks).toHaveLength(6);
    expect(result.current.lastBackup?.tone).toBe('ok');
  });

  it('renders checks, server facts and the placeholders', async () => {
    mockApi.db.system.maintenance = { active: true, reason: 'Rolling back to 0.1.0…' };
    await renderPage(() => <SystemPage />);
    expect(await screen.findByText('Outbound email (SMTP)')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Configure' }).getAttribute('href')).toBe(
      '/settings/email',
    );
    expect(screen.getByText('3 days 4 hours')).toBeTruthy();
    expect(screen.getByText(/Rolling back to 0\.1\.0… Changes are paused/)).toBeTruthy();
    expect(screen.getByText('Available with the AI runtime')).toBeTruthy();
    expect(screen.getByText('Job queue figures arrive with the jobs dashboard.')).toBeTruthy();
  });
});
