import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BACKUP_IDS } from '../mocks/seed/operations.ts';
import { BackupsPage } from '../pages/settings/backups-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { DEFAULT_POLICY } from './use-backups-schedule.ts';
import { nextRunLabel, statusLine, useBackups } from './use-backups.ts';

describe('backups list', () => {
  it('says when the next run is, in the schedule’s timezone', () => {
    const schedule = DEFAULT_POLICY.schedule;
    expect(nextRunLabel(schedule)).toBe('next run 02:00 UTC');
    expect(nextRunLabel({ ...schedule, frequency: 'weekly', weekday: 1 })).toBe(
      'next run Monday 02:00 UTC',
    );
    expect(nextRunLabel({ ...schedule, frequency: 'hourly' })).toBe('runs every hour');
  });

  it('summarises the last good backup, the next run and one disk', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const parts = statusLine(result.current.backups, DEFAULT_POLICY.schedule, false);
    expect(parts[0]?.text).toMatch(/^Last good backup (\d+h ago|yesterday)$/);
    expect(parts.slice(1).map((part) => part.text)).toEqual([
      'verified',
      'next run 02:00 UTC',
      'one disk',
    ]);
    expect(statusLine(result.current.backups, undefined, true).map((p) => p.text)).not.toContain(
      'one disk',
    );
  });

  it('restores the picked backup, then shows maintenance and pauses writes', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.restorable.every((backup) => backup.status === 'succeeded')).toBe(true);
    act(() => result.current.restorePicker.show());
    expect(result.current.restorePicker.open).toBe(true);
    act(() => result.current.restoreDialog.open(BACKUP_IDS.latest));
    expect(result.current.restorePicker.open).toBe(false);
    expect(result.current.restoreDialog.target?.id).toBe(BACKUP_IDS.latest);
    act(() => result.current.restore.mutate(BACKUP_IDS.latest));
    await waitFor(() => expect(result.current.restore.isSuccess).toBe(true));
    expect(mockApi.db.audit[0]?.action).toBe('backup.restored');
    await waitFor(() => expect(result.current.maintenance.active).toBe(true));
    expect(result.current.maintenance.message).toMatch(/^Restoring the backup/);
    act(() => result.current.run.mutate());
    await waitFor(() => expect(result.current.run.isError).toBe(true));
    expect(result.current.run.error).toMatchObject({ code: 'maintenance' });
  });

  it('checks an archive and runs a restore drill', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.verify.mutate({ id: BACKUP_IDS.older, depth: 'list' }));
    await waitFor(() => expect(result.current.backups[3]?.verification.state).toBe('listed'));
    act(() => result.current.verify.mutate({ id: BACKUP_IDS.older, depth: 'restore' }));
    await waitFor(() => expect(result.current.backups[3]?.verification.state).toBe('restored'));
  });

  it('backs up now and lists the new backup first', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.run.mutate());
    await waitFor(() => expect(result.current.backups).toHaveLength(7));
    expect(result.current.backups[0]?.kind).toBe('manual');
  });

  it('renders the status line, the .env warning and the list', async () => {
    await renderPage(() => <BackupsPage />);
    expect(await screen.findByText('one disk')).toBeTruthy();
    expect(screen.getByText(/One disk: backups sit on the same disk/)).toBeTruthy();
    expect(screen.getByText('/var/bemmoly/.env')).toBeTruthy();
    expect(screen.getByText('NOT CONFIGURED')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Backups' })).toBeTruthy();
    const download = screen.getAllByRole('link', { name: /^Download the backup/ })[0];
    expect(download?.getAttribute('href')).toBe(
      `/api/v1/admin/backups/${BACKUP_IDS.latest}/download`,
    );
  });
});
