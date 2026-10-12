import type { SettingsRegistry } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { createPairingService } from './index.ts';

/*
 * The matrix from stints placed at known times: three on one issue are three pairs, the hours
 * are the overlap clipped to the window, and a pairing before the window is left out.
 */

describe('pairing matrix against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (start.available) work = start.harness;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  const place = (issueId: string, userId: string, from: string, to: string | null) =>
    work.sql`
      update issue_assignees set added_at = ${from}::timestamptz,
        removed_at = ${to}::timestamptz
      where issue_id = ${issueId} and user_id = ${userId}`;

  it('counts every overlapping pair once, clipped to the window', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member, outsider } = work.users;
    const as = work.as(admin);
    const project = await work.project('MOB', [member]);
    const mob = await work.issue(project, 'Mob on it', { assigneeId: admin });
    await work.services.issues.setAssignees(as, mob.key, {
      assigneeIds: [admin, member, outsider],
    });
    await place(mob.id, admin, '2026-09-01T08:00Z', '2026-09-01T18:00Z');
    await place(mob.id, member, '2026-09-01T10:00Z', '2026-09-01T12:00Z');
    await place(mob.id, outsider, '2026-09-01T11:00Z', '2026-09-02T00:00Z');
    const old = await work.issue(project, 'Long ago', { assigneeId: admin });
    await work.services.issues.setAssignees(as, old.key, { assigneeIds: [admin, member] });
    await place(old.id, admin, '2026-01-01T00:00Z', '2026-01-02T00:00Z');
    await place(old.id, member, '2026-01-01T00:00Z', '2026-01-02T00:00Z');

    const matrix = await work.services.pairing.matrix(as, 'MOB', {
      from: '2026-08-01',
      to: '2026-09-30',
    });
    expect(matrix.people.map((person) => person.id).sort()).toEqual(
      [admin, member, outsider].sort(),
    );
    const cell = (x: string, y: string) =>
      matrix.cells.find((one) => (one.a === x && one.b === y) || (one.a === y && one.b === x));
    expect(cell(admin, member)).toMatchObject({ count: 1, hours: 2, issues: [{ key: mob.key }] });
    expect(cell(admin, outsider)).toMatchObject({ count: 1, hours: 7 });
    expect(cell(member, outsider)).toMatchObject({ count: 1, hours: 1 });
    expect(matrix.cells).toHaveLength(3);

    const january = await work.services.pairing.matrix(as, 'MOB', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(january.cells).toEqual([expect.objectContaining({ count: 1, hours: 24 })]);
  });

  it('suggests next pairs only while the setting is on', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member } = work.users;
    const as = work.as(admin);
    const project = await work.project('SUG', [member]);
    await work.issue(project, 'One', { assigneeId: admin });
    await work.issue(project, 'Two', { assigneeId: member });
    const range = { from: '2026-01-01', to: '2099-12-31' };

    const off = await work.services.pairing.matrix(as, 'SUG', range);
    expect(off.suggestions).toBeUndefined();

    const turnedOn = (() => Promise.resolve(true)) as SettingsRegistry['get'];
    const on = createPairingService({ database: work.sql, settings: { get: turnedOn } });
    const matrix = await on.matrix(as, 'SUG', range);
    expect(matrix.suggestions).toHaveLength(1);
    expect(matrix.suggestions?.[0]).toMatchObject({ count: 0, lastPairedAt: null });
    expect([matrix.suggestions?.[0]?.a, matrix.suggestions?.[0]?.b].sort()).toEqual(
      [admin, member].sort(),
    );
  });
});
