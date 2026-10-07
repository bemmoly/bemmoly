import { describe, expect, it } from 'vitest';
import type { ChangesetTraits } from '../../../contracts/changelog-tags.ts';
import {
  decideRollbackMode,
  describeRollback,
  withinCompatibilityWindow,
} from './rollback-mode.ts';

const changeset = (id: string, traits: Partial<ChangesetTraits> = {}): ChangesetTraits => ({
  module: 'work',
  id,
  orderExecuted: Number(id.slice(0, 4)),
  hasDown: true,
  irreversible: false,
  ...traits,
});

const base = {
  fromVersion: '1.3.0',
  toVersion: '1.2.4',
  preferRestore: false,
  hasPreUpgradeBackup: true,
};

describe('withinCompatibilityWindow', () => {
  it('accepts the same or the previous minor of one major', () => {
    expect(withinCompatibilityWindow('1.3.0', '1.2.4')).toBe(true);
    expect(withinCompatibilityWindow('1.3.2', '1.3.0')).toBe(true);
    expect(withinCompatibilityWindow('1.5.0', '1.3.0')).toBe(false);
    expect(withinCompatibilityWindow('2.0.0', '1.9.0')).toBe(false);
    expect(withinCompatibilityWindow('nope', '1.0.0')).toBe(false);
  });
});

describe('decideRollbackMode', () => {
  it('is a code rollback when nothing ran since the tag', () => {
    expect(decideRollbackMode({ ...base, changesetsSinceTag: [] }).mode).toBe('code');
  });

  it('is a code rollback for compatible changesets inside the window', () => {
    const decision = decideRollbackMode({ ...base, changesetsSinceTag: [changeset('0007-rank')] });
    expect(decision.mode).toBe('code');
  });

  it('is a restore when any changeset is irreversible, naming it', () => {
    const decision = decideRollbackMode({
      ...base,
      changesetsSinceTag: [changeset('0007-rank'), changeset('0008-drop', { irreversible: true })],
    });
    expect(decision).toMatchObject({ mode: 'restore' });
    expect(decision.reason).toContain('work/0008-drop');
  });

  it('runs downs newest first when several minors are skipped and every changeset has one', () => {
    const decision = decideRollbackMode({
      ...base,
      fromVersion: '1.6.0',
      changesetsSinceTag: [changeset('0007-a'), changeset('0009-c'), changeset('0008-b')],
    });
    expect(decision.mode).toBe('schema');
    expect(decision.schemaChangesets.map((item) => item.id)).toEqual([
      '0009-c',
      '0008-b',
      '0007-a',
    ]);
  });

  it('falls back to a restore when a skipped-minor changeset has no down', () => {
    const decision = decideRollbackMode({
      ...base,
      fromVersion: '1.6.0',
      changesetsSinceTag: [changeset('0007-a', { hasDown: false })],
    });
    expect(decision.mode).toBe('restore');
  });

  it('restores when asked, and when the tag is unknown but a backup exists', () => {
    expect(decideRollbackMode({ ...base, changesetsSinceTag: [], preferRestore: true }).mode).toBe(
      'restore',
    );
    expect(decideRollbackMode({ ...base, changesetsSinceTag: null }).mode).toBe('restore');
    expect(
      decideRollbackMode({ ...base, changesetsSinceTag: null, hasPreUpgradeBackup: false }).mode,
    ).toBe('code');
  });
});

describe('describeRollback', () => {
  it('names the discard count the way the design shows it', () => {
    const text = describeRollback(
      { mode: 'restore', reason: '', schemaChangesets: [] },
      '1.2.4',
      { changes: 142, people: 11, since: new Date('2026-10-07T09:02:00Z') },
      'UTC',
    );
    expect(text).toBe(
      'Restoring 1.2.4 will discard 142 changes made since 7 Oct, 09:02 by 11 people.',
    );
  });

  it('says nothing is lost for a code rollback', () => {
    expect(
      describeRollback({ mode: 'code', reason: '', schemaChangesets: [] }, '1.2.4', null, 'UTC'),
    ).toContain('Nothing is lost');
  });
});
