import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPeopleHarness, type PeopleHarness } from '../../testing/harness.ts';

describe('the directory and profiles against Postgres', () => {
  let h: PeopleHarness;
  let skip: string | null = null;

  beforeAll(async () => {
    const started = await startPeopleHarness(() => new Date('2026-10-22T10:00:00Z'));
    if (!started.available) {
      skip = started.reason;
      return;
    }
    h = started.harness;
    const admin = h.actor('admin');
    await h.kernel.records.create(admin, { userId: h.ids.manager, state: 'active' });
    await h.kernel.records.create(admin, {
      userId: h.ids.ana,
      state: 'offer_accepted',
      startDate: '2026-11-02',
      managerId: h.ids.manager,
      jobTitle: 'Frontend engineer',
    });
    await h.kernel.records.create(admin, {
      userId: h.ids.ben,
      state: 'leaving',
      startDate: '2024-01-08',
      endDate: '2026-12-31',
      managerId: h.ids.manager,
    });
  });
  afterAll(async () => {
    if (!skip) await h.stop();
  });
  beforeEach((ctx) => {
    if (skip) ctx.skip(skip);
  });

  it('lists people with what is happening to them, and searches by title', async () => {
    const rows = await h.services.directory.list(h.as('ben'), {});
    const byId = new Map(rows.map((row) => [row.userId, row.happening]));
    expect(byId.get(h.ids.ana)).toMatchObject({ kind: 'joining', date: '2026-11-02' });
    expect(byId.get(h.ids.ben)).toMatchObject({ kind: 'leaving', date: '2026-12-31' });
    expect(byId.get(h.ids.manager)).toBeNull();
    const found = await h.services.directory.list(h.as('ben'), { q: 'frontend' });
    expect(found.map((row) => row.userId)).toEqual([h.ids.ana]);
  });

  it('shows the reporting line and the company fields on a profile', async () => {
    await h.services.directory.createField(h.as('admin'), {
      key: 'shirt_size',
      label: 'Shirt size',
      kind: 'select',
      options: [
        { value: 's', label: 'S' },
        { value: 'm', label: 'M' },
      ],
    });
    const profile = await h.services.directory.profile(h.as('manager'), h.ids.ana);
    expect(profile.managers.map((p) => p.userId)).toEqual([h.ids.manager]);
    expect(profile.fields.definitions.map((f) => f.key)).toEqual(['shirt_size']);
    const reports = await h.services.directory.profile(h.as('ana'), h.ids.manager);
    expect(reports.reports.map((p) => p.userId).sort()).toEqual([h.ids.ana, h.ids.ben].sort());
  });

  it('lets a person fill their own fields, and HR anyone’s', async () => {
    const own = await h.services.directory.updateFields(h.as('ana'), h.ids.ana, {
      shirt_size: 'm',
    });
    expect(own.values).toEqual({ shirt_size: 'm' });
    await expect(
      h.services.directory.updateFields(h.as('ben'), h.ids.ana, { shirt_size: 's' }),
    ).rejects.toThrow(ForbiddenError);
    const byAdmin = await h.services.directory.updateFields(h.as('admin'), h.ids.ana, {
      shirt_size: 's',
    });
    expect(byAdmin.values).toEqual({ shirt_size: 's' });
  });

  it('keeps the ladder in order for People admins only', async () => {
    await h.services.levels.create(h.as('admin'), { name: 'L1' });
    await h.services.levels.create(h.as('admin'), { name: 'L2' });
    expect((await h.services.levels.list()).map((l) => l.name)).toEqual(['L1', 'L2']);
    await expect(h.services.levels.create(h.as('ana'), { name: 'L3' })).rejects.toThrow(
      ForbiddenError,
    );
  });
});
