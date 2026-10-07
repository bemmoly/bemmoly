import type { Backup } from '@bemmoly/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemPage } from '../pages/settings/system-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { healthTone, lastBackupLine, useSystem } from './use-system.ts';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const backup = (patch: Partial<Backup>): Backup => ({
  id: 'bk-1',
  kind: 'scheduled',
  tier: 'daily',
  status: 'succeeded',
  startedAt: '2026-10-07T04:58:00.000Z',
  finishedAt: '2026-10-07T05:00:00.000Z',
  sizeBytes: 412_000_000,
  appVersion: '0.1.1',
  destination: '/var/bemmoly/backups',
  verification: 'verified',
  verifiedAt: null,
  error: null,
  ...patch,
});

describe('system status', () => {
  it('maps health to circle tones', () => {
    expect(healthTone('ok')).toBe('ok');
    expect(healthTone('warning')).toBe('caution');
    expect(healthTone('failed')).toBe('danger');
  });

  it('flags a missing, failed or stale last backup', () => {
    expect(lastBackupLine(null, NOW).tone).toBe('caution');
    expect(lastBackupLine(backup({}), NOW)).toMatchObject({ tone: 'ok' });
    expect(lastBackupLine(backup({}), NOW).text).toMatch(/verified · 412 MB$/);
    expect(lastBackupLine(backup({ status: 'failed' }), NOW).tone).toBe('danger');
    const old = backup({ finishedAt: '2026-10-05T05:00:00.000Z' });
    expect(lastBackupLine(old, NOW).tone).toBe('caution');
  });

  it('loads the status', async () => {
    const { result } = await renderQueryHook(() => useSystem());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.status?.queue.scheduled).toBe(3);
    expect(result.current.lastBackup?.tone).toBe('ok');
  });

  it('renders health, the queue and the AI spend placeholder', async () => {
    await renderPage(() => <SystemPage />);
    expect(await screen.findByText('Outbound email (SMTP)')).toBeTruthy();
    expect(screen.getByText('Scheduled')).toBeTruthy();
    expect(screen.getByText('Available with the AI runtime')).toBeTruthy();
  });
});
