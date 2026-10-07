import { backupRetentionSettingsSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { selectRetained, type RetentionCandidate } from './retention.ts';

const NOW = new Date('2026-10-07T12:00:00Z');
const DAY = 86_400_000;

function daily(days: number, extra: Partial<RetentionCandidate> = {}): RetentionCandidate[] {
  return Array.from({ length: days }, (_, index) => ({
    id: `d${index}`,
    kind: 'scheduled' as const,
    status: 'succeeded' as const,
    createdAt: new Date(NOW.getTime() - index * DAY - 10 * 3_600_000),
    baseBackupId: null,
    ...extra,
  }));
}

const policy = (overrides: Partial<ReturnType<typeof backupRetentionSettingsSchema.parse>> = {}) =>
  backupRetentionSettingsSchema.parse({ hourly: 0, ...overrides });

describe('selectRetained (grandfather-father-son)', () => {
  it('keeps 7 daily, 4 weekly and 3 monthly from a year of nightly backups by default', () => {
    const decision = selectRetained(daily(365), policy(), 'UTC', NOW);
    // 7 days + up to 4 weeks + up to 3 months, overlapping where buckets coincide.
    expect(decision.keep.length).toBeGreaterThanOrEqual(7);
    expect(decision.keep.length).toBeLessThanOrEqual(14);
    for (let index = 0; index < 7; index += 1) expect(decision.keep).toContain(`d${index}`);
    expect(decision.prune).toContain('d300');
    expect(decision.keep.length + decision.prune.length).toBe(365);
  });

  it('keeps the newest backup in each bucket', () => {
    const twoPerDay = [
      ...daily(3),
      ...daily(3).map((backup) => ({
        ...backup,
        id: `${backup.id}-early`,
        createdAt: new Date(backup.createdAt.getTime() - 3_600_000),
      })),
    ];
    const decision = selectRetained(
      twoPerDay,
      policy({ daily: 3, weekly: 0, monthly: 0 }),
      'UTC',
      NOW,
    );
    expect(decision.keep.sort()).toEqual(['d0', 'd1', 'd2']);
  });

  it('keeps pre-upgrade backups for their own window only', () => {
    const backups: RetentionCandidate[] = [
      ...daily(2),
      {
        id: 'pre-new',
        kind: 'pre_upgrade',
        status: 'succeeded',
        createdAt: new Date(NOW.getTime() - 2 * DAY),
        baseBackupId: null,
      },
      {
        id: 'pre-old',
        kind: 'pre_upgrade',
        status: 'succeeded',
        createdAt: new Date(NOW.getTime() - 9 * DAY),
        baseBackupId: null,
      },
    ];
    const decision = selectRetained(backups, policy(), 'UTC', NOW);
    expect(decision.keep).toContain('pre-new');
    expect(decision.prune).toContain('pre-old');
  });

  it('keeps every set an incremental backup depends on', () => {
    const backups: RetentionCandidate[] = [
      {
        id: 'full',
        kind: 'scheduled',
        status: 'succeeded',
        createdAt: new Date(NOW.getTime() - 20 * DAY),
        baseBackupId: null,
      },
      {
        id: 'inc1',
        kind: 'scheduled',
        status: 'succeeded',
        createdAt: new Date(NOW.getTime() - 19 * DAY),
        baseBackupId: 'full',
      },
      {
        id: 'inc2',
        kind: 'scheduled',
        status: 'succeeded',
        createdAt: new Date(NOW.getTime() - 1 * DAY),
        baseBackupId: 'inc1',
      },
    ];
    const decision = selectRetained(
      backups,
      policy({ daily: 1, weekly: 0, monthly: 0 }),
      'UTC',
      NOW,
    );
    expect(decision.keep.sort()).toEqual(['full', 'inc1', 'inc2']);
    expect(decision.reasons['full']).toContain('chain of inc2');
  });

  it('never prunes a running backup and drops failed rows after 30 days', () => {
    const backups: RetentionCandidate[] = [
      {
        id: 'running',
        kind: 'manual',
        status: 'running',
        createdAt: new Date(NOW.getTime() - 40 * DAY),
        baseBackupId: null,
      },
      {
        id: 'failed-old',
        kind: 'manual',
        status: 'failed',
        createdAt: new Date(NOW.getTime() - 40 * DAY),
        baseBackupId: null,
      },
      {
        id: 'failed-new',
        kind: 'manual',
        status: 'failed',
        createdAt: new Date(NOW.getTime() - 2 * DAY),
        baseBackupId: null,
      },
    ];
    const decision = selectRetained(backups, policy(), 'UTC', NOW);
    expect(decision.prune).toEqual(['failed-old']);
  });

  it('always keeps the newest good backup even with every count at zero', () => {
    const decision = selectRetained(
      daily(3),
      policy({ daily: 0, weekly: 0, monthly: 0 }),
      'UTC',
      NOW,
    );
    expect(decision.keep).toEqual(['d0']);
  });

  it('buckets days in the workspace timezone', () => {
    // 23:30 and 00:30 UTC on consecutive UTC days are the same day in Los Angeles.
    const backups: RetentionCandidate[] = [
      {
        id: 'late',
        kind: 'scheduled',
        status: 'succeeded',
        createdAt: new Date('2026-10-06T00:30:00Z'),
        baseBackupId: null,
      },
      {
        id: 'early',
        kind: 'scheduled',
        status: 'succeeded',
        createdAt: new Date('2026-10-05T23:30:00Z'),
        baseBackupId: null,
      },
    ];
    const keepUtc = selectRetained(
      backups,
      policy({ daily: 2, weekly: 0, monthly: 0 }),
      'UTC',
      NOW,
    ).keep;
    const keepLa = selectRetained(
      backups,
      policy({ daily: 2, weekly: 0, monthly: 0 }),
      'America/Los_Angeles',
      NOW,
    ).keep;
    expect(keepUtc.sort()).toEqual(['early', 'late']);
    expect(keepLa).toEqual(['late']);
  });
});
