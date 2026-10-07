import { act, screen, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { BACKUP_IDS } from '../mocks/seed/operations.ts';
import { BackupsPage } from '../pages/settings/backups-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  backupSaveValues,
  DEFAULT_POLICY,
  EMPTY_S3,
  policyErrors,
  useBackupSchedule,
} from './use-backups-schedule.ts';
import { nextRunLabel, statusLine, useBackups } from './use-backups.ts';

const submitEvent = { preventDefault: () => undefined } as FormEvent;
const bucket = { ...EMPTY_S3, bucket: 'acme-backups', accessKeyId: 'AKIA1', secretAccessKey: 's' };

describe('backup settings', () => {
  it('writes the S3 secret only when it is replaced or removed', () => {
    const keep = backupSaveValues(DEFAULT_POLICY, { mode: 'keep' });
    expect(keep).not.toHaveProperty('system.backups.s3');
    expect(keep['system.backups.schedule']).toEqual(DEFAULT_POLICY.schedule);
    expect(backupSaveValues(DEFAULT_POLICY, { mode: 'remove' })['system.backups.s3']).toBeNull();
    expect(
      backupSaveValues(DEFAULT_POLICY, { mode: 'replace', form: { ...bucket, endpoint: ' ' } })[
        'system.backups.s3'
      ],
    ).toEqual({
      enabled: true,
      region: 'us-east-1',
      bucket: 'acme-backups',
      prefix: 'bemmoly/',
      accessKeyId: 'AKIA1',
      secretAccessKey: 's',
      forcePathStyle: false,
    });
  });

  it('checks the schedule, retention and a new destination', () => {
    const errors = policyErrors(
      {
        ...DEFAULT_POLICY,
        schedule: { ...DEFAULT_POLICY.schedule, time: '25:00' },
        retention: { ...DEFAULT_POLICY.retention, preUpgradeDays: 0 },
      },
      { mode: 'replace', form: EMPTY_S3 },
    );
    expect(Object.keys(errors).sort()).toEqual([
      'retention.preUpgradeDays',
      's3.accessKeyId',
      's3.bucket',
      's3.secretAccessKey',
      'schedule.time',
    ]);
    expect(policyErrors(DEFAULT_POLICY, { mode: 'replace', form: bucket })).toEqual({});
  });

  it('says when the next run is, in the schedule’s timezone', () => {
    const schedule = DEFAULT_POLICY.schedule;
    expect(nextRunLabel(schedule)).toBe('next run 02:00 UTC');
    expect(nextRunLabel({ ...schedule, frequency: 'weekly', weekday: 1 })).toBe(
      'next run Monday 02:00 UTC',
    );
    expect(nextRunLabel({ ...schedule, frequency: 'hourly' })).toBe('runs every hour');
  });

  it('saves the schedule and keeps the stored destination untouched', async () => {
    mockApi.db.settings['system.backups.s3'] = { ...bucket, enabled: true };
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.policy).toBeDefined());
    expect(result.current.s3Configured).toBe(true);
    const policy = result.current.policy ?? DEFAULT_POLICY;
    act(() => result.current.update({ schedule: { ...policy.schedule, frequency: '6h' } }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings['system.backups.schedule']).toMatchObject({ frequency: '6h' });
    expect(mockApi.db.settings['system.backups.s3']).toMatchObject({ bucket: 'acme-backups' });
  });

  it('writes a new destination as one secret value', async () => {
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.policy).toBeDefined());
    expect(result.current.s3Configured).toBe(false);
    act(() => result.current.startS3());
    act(() => result.current.editS3({ ...bucket, bucket: 'new-bucket' }));
    act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings['system.backups.s3']).toMatchObject({
      bucket: 'new-bucket',
      secretAccessKey: 's',
    });
    expect(result.current.s3).toEqual({ mode: 'keep' });
  });
});

describe('backups list', () => {
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

  it('restores after the typed id, then shows maintenance and pauses writes', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.restoreDialog.open(BACKUP_IDS.latest));
    expect(result.current.restoreDialog.canRestore).toBe(false);
    act(() => result.current.restoreDialog.setTyped(BACKUP_IDS.latest));
    expect(result.current.restoreDialog.canRestore).toBe(true);
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
