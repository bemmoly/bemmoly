import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  bucketFromLocations,
  destinationRisk,
  protectionRisk,
  retentionRisk,
} from './use-backups-risks.ts';
import {
  DEFAULT_POLICY,
  EMPTY_S3,
  sectionWrites,
  useBackupSchedule,
} from './use-backups-schedule.ts';

const bucket = { ...EMPTY_S3, bucket: 'acme-backups', accessKeyId: 'AKIA1', secretAccessKey: 's' };
const drafts = { policy: DEFAULT_POLICY, s3: { mode: 'keep' } as const };

describe('backup settings, one section at a time', () => {
  it('writes only the saved section, and the S3 secret only when replaced or removed', () => {
    expect(sectionWrites('schedule', drafts)).toEqual({
      values: { 'system.backups.schedule': DEFAULT_POLICY.schedule },
    });
    expect(sectionWrites('destinations', drafts)).toEqual({ values: {} });
    expect(sectionWrites('destinations', { ...drafts, s3: { mode: 'remove' } })).toEqual({
      values: { 'system.backups.s3': null },
    });
    expect(
      sectionWrites('destinations', {
        ...drafts,
        s3: { mode: 'replace', form: { ...bucket, endpoint: ' ' } },
      }),
    ).toEqual({
      values: {
        'system.backups.s3': {
          enabled: true,
          region: 'us-east-1',
          bucket: 'acme-backups',
          prefix: 'bemmoly/',
          accessKeyId: 'AKIA1',
          secretAccessKey: 's',
          forcePathStyle: false,
        },
      },
    });
  });

  it('returns field messages for the section being saved', () => {
    const policy = {
      ...DEFAULT_POLICY,
      schedule: { ...DEFAULT_POLICY.schedule, time: '25:00' },
      retention: { ...DEFAULT_POLICY.retention, preUpgradeDays: 0 },
    };
    expect(sectionWrites('schedule', { policy, s3: { mode: 'keep' } })).toEqual({
      errors: { 'schedule.time': expect.any(String) },
    });
    expect(sectionWrites('retention', { policy, s3: { mode: 'keep' } })).toEqual({
      errors: { 'retention.preUpgradeDays': expect.any(String) },
    });
    const s3 = sectionWrites('destinations', { policy, s3: { mode: 'replace', form: EMPTY_S3 } });
    expect(Object.keys('errors' in s3 ? s3.errors : {}).sort()).toEqual([
      's3.accessKeyId',
      's3.bucket',
      's3.secretAccessKey',
    ]);
  });

  it('saves the schedule without touching retention edits or the stored bucket', async () => {
    mockApi.db.settings['system.backups.s3'] = { ...bucket, enabled: true };
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.policy).toBeDefined());
    expect(result.current.s3Configured).toBe(true);
    act(() => result.current.updateSchedule({ frequency: '6h' }));
    act(() => result.current.updateRetention({ daily: 30 }));
    expect(result.current.dirty).toMatchObject({ schedule: true, retention: true });
    const values = result.current.prepare('schedule');
    let saved = false;
    act(() => result.current.save('schedule', values ?? {}, () => (saved = true)));
    await waitFor(() => expect(saved).toBe(true));
    expect(mockApi.db.settings['system.backups.schedule']).toMatchObject({ frequency: '6h' });
    expect(mockApi.db.settings['system.backups.s3']).toMatchObject({ bucket: 'acme-backups' });
    expect(result.current.dirty).toMatchObject({ schedule: false, retention: true });
    expect(result.current.policy?.retention.daily).toBe(30);
  });

  it('writes a new destination as one secret value', async () => {
    const { result } = await renderQueryHook(() => useBackupSchedule());
    await waitFor(() => expect(result.current.policy).toBeDefined());
    act(() => result.current.startS3());
    act(() => result.current.editS3({ ...bucket, bucket: 'new-bucket' }));
    const values = result.current.prepare('destinations');
    act(() => result.current.save('destinations', values ?? {}, () => undefined));
    await waitFor(() => expect(result.current.s3).toEqual({ mode: 'keep' }));
    expect(mockApi.db.settings['system.backups.s3']).toMatchObject({
      bucket: 'new-bucket',
      secretAccessKey: 's',
    });
  });
});

describe('changes that need a confirmation', () => {
  const retention = DEFAULT_POLICY.retention;

  it('asks for "confirm" before lowering any retention tier', () => {
    expect(retentionRisk(retention, { ...retention, daily: retention.daily + 1 })).toBeNull();
    const risk = retentionRisk(retention, { ...retention, daily: 3 });
    expect(risk?.confirmWord).toBe('confirm');
    expect(risk?.consequences[0]).toBe(
      `Daily: ${retention.daily} → 3 kept. Up to ${retention.daily - 3} older daily backups are deleted.`,
    );
  });

  it('asks for the bucket name before removing the destination', () => {
    expect(destinationRisk(false, { mode: 'remove' }, null)).toBeNull();
    expect(destinationRisk(true, { mode: 'remove' }, 'acme-backups')?.confirmWord).toBe(
      'acme-backups',
    );
    expect(destinationRisk(true, { mode: 'remove' }, null)?.confirmWord).toBe('remove');
    const replace = destinationRisk(true, { mode: 'replace', form: bucket }, 'old-bucket');
    expect(replace?.confirmWord).toBeUndefined();
    expect(replace?.tone).toBe('caution');
  });

  it('asks before turning local encryption off, not on', () => {
    const on = { encryption: { local: true }, verification: DEFAULT_POLICY.verification };
    const off = { ...on, encryption: { local: false } };
    expect(protectionRisk(off, on)).toBeNull();
    expect(protectionRisk(on, off)?.confirmLabel).toBe('Turn off encryption');
  });

  it('reads the bucket from an S3 location', () => {
    expect(bucketFromLocations(['/var/bemmoly/backups/x', 's3://acme-backups/set-1'])).toBe(
      'acme-backups',
    );
    expect(bucketFromLocations(['/var/bemmoly/backups/x'])).toBeNull();
  });
});
