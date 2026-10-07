import type { BackupSchedule } from '@bemmoly/shared';
import { act, screen, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { BackupsPage } from '../pages/settings/backups-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  backupSaveValues,
  DEFAULT_SCHEDULE,
  EMPTY_BUCKET,
  scheduleErrors,
  useBackupSchedule,
} from './use-backups-schedule.ts';
import { statusLine, useBackups } from './use-backups.ts';

const submitEvent = { preventDefault: () => undefined } as FormEvent;
const withBucket: BackupSchedule = {
  ...DEFAULT_SCHEDULE,
  s3: { ...EMPTY_BUCKET, bucket: 'acme-backups' },
};

describe('backup schedule', () => {
  it('writes secrets only when the admin typed them, and only with a bucket', () => {
    expect(
      backupSaveValues(DEFAULT_SCHEDULE, { accessKeyId: 'AKIA', secretAccessKey: 's' }),
    ).toEqual({ 'backups.schedule': DEFAULT_SCHEDULE });
    expect(backupSaveValues(withBucket, { accessKeyId: null, secretAccessKey: '' })).toEqual({
      'backups.schedule': { ...withBucket, encryption: true },
    });
    expect(backupSaveValues(withBucket, { accessKeyId: ' AKIA ', secretAccessKey: 'shh' })).toEqual(
      {
        'backups.schedule': { ...withBucket, encryption: true },
        'backups.s3.accessKeyId': 'AKIA',
        'backups.s3.secretAccessKey': 'shh',
      },
    );
  });

  it('asks for a bucket and credentials that are not stored yet', () => {
    const none = { accessKeyId: null, secretAccessKey: null };
    const errors = scheduleErrors({ ...withBucket, s3: EMPTY_BUCKET }, none, {
      accessKeyId: false,
      secretAccessKey: false,
    });
    expect(Object.keys(errors).sort()).toEqual(['accessKeyId', 's3.bucket', 'secretAccessKey']);
    expect(scheduleErrors(withBucket, none, { accessKeyId: true, secretAccessKey: true })).toEqual(
      {},
    );
    expect(
      scheduleErrors({ ...DEFAULT_SCHEDULE, timeOfDay: '25:00' }, none, {
        accessKeyId: false,
        secretAccessKey: false,
      }),
    ).toHaveProperty('timeOfDay');
  });

  it('saves the schedule and keeps stored secrets when the fields stay blank', async () => {
    mockApi.db.settings['backups.s3.secretAccessKey'] = 'stored-secret';
    mockApi.db.settings['backups.s3.accessKeyId'] = 'stored-id';
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.schedule).toBeDefined());
    act(() => result.current.update({ frequency: 'every_6_hours', timeOfDay: '03:30' }));
    act(() => result.current.setBucket(true));
    act(() =>
      result.current.update({ s3: { ...EMPTY_BUCKET, bucket: 'acme-backups', region: 'eu' } }),
    );
    expect(result.current.dirty).toBe(true);
    act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    const saved = mockApi.db.settings['backups.schedule'] as BackupSchedule;
    expect(saved).toMatchObject({
      frequency: 'every_6_hours',
      timeOfDay: '03:30',
      encryption: true,
    });
    expect(saved.s3?.bucket).toBe('acme-backups');
    expect(mockApi.db.settings['backups.s3.secretAccessKey']).toBe('stored-secret');
    expect(mockApi.db.settings['backups.s3.accessKeyId']).toBe('stored-id');
  });

  it('writes a typed secret', async () => {
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.schedule).toBeDefined());
    act(() => result.current.setBucket(true));
    act(() => result.current.update({ s3: { ...EMPTY_BUCKET, bucket: 'b' } }));
    act(() => result.current.setSecret({ accessKeyId: 'AKIA1' }));
    act(() => result.current.setSecret({ secretAccessKey: 'new-secret' }));
    act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings['backups.s3.accessKeyId']).toBe('AKIA1');
    expect(mockApi.db.settings['backups.s3.secretAccessKey']).toBe('new-secret');
    expect(result.current.secrets).toEqual({ accessKeyId: null, secretAccessKey: null });
  });
});

describe('backups list', () => {
  it('summarises the last good backup, the next run and one disk', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const parts = statusLine(result.current.summary, result.current.backups, 'UTC');
    expect(parts[0]?.text).toMatch(/^Last good backup (\d+h ago|yesterday)$/);
    expect(parts.slice(1).map((part) => part.text)).toEqual([
      'verified',
      'next run 02:00 UTC',
      'one disk',
    ]);
    expect(parts.find((part) => part.text === 'one disk')?.caution).toBe(true);
  });

  it('restores only after the backup id is typed back', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.restoreDialog.open('bk-0007'));
    expect(result.current.restoreDialog.canRestore).toBe(false);
    act(() => result.current.restoreDialog.setTyped('bk-0007'));
    expect(result.current.restoreDialog.canRestore).toBe(true);
    act(() => result.current.restore.mutate('bk-0007'));
    await waitFor(() => expect(result.current.restore.isSuccess).toBe(true));
    expect(mockApi.db.audit[0]?.action).toBe('backup.restored');
  });

  it('renders the page with the status line, the .env warning and the list', async () => {
    await renderPage(() => <BackupsPage />);
    expect(await screen.findByText('one disk')).toBeTruthy();
    expect(screen.getByText(/One disk: backups sit on the same disk/)).toBeTruthy();
    expect(screen.getByText('/var/bemmoly/.env')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Backups' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download bk-0007' }).getAttribute('href')).toBe(
      '/api/v1/admin/backups/bk-0007/download',
    );
  });

  it('backs up now and lists the new backup first', async () => {
    const { result } = await renderQueryHook(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.run.mutate());
    await waitFor(() => expect(result.current.backups).toHaveLength(7));
    expect(result.current.backups[0]?.kind).toBe('manual');
  });
});
