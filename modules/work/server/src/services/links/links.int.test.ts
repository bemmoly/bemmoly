import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('links against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let blocker: Issue;
  let blocked: Issue;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('LNK', [work.users.member]);
    blocker = await work.issue(project, 'Migrate the session store');
    blocked = await work.issue(project, 'Remove the legacy cookie path');
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('stores one row and reads it from both ends', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    const link = await work.services.links.create(member, blocker.key, {
      targetId: blocked.id,
      kind: 'blocks',
    });
    expect(link).toMatchObject({ sourceId: blocker.id, targetId: blocked.id, kind: 'blocks' });
    expect(await work.services.links.list(member, blocked.key)).toEqual([link]);
    const fromBlocker = await work.services.issues.get(member, blocker.key);
    const fromBlocked = await work.services.issues.get(member, blocked.key);
    expect(fromBlocker.links).toEqual([
      expect.objectContaining({
        kind: 'blocks',
        inverse: false,
        issue: expect.objectContaining({ key: blocked.key }),
      }),
    ]);
    expect(fromBlocked.links).toEqual([
      expect.objectContaining({
        kind: 'blocks',
        inverse: true,
        issue: expect.objectContaining({ key: blocker.key }),
      }),
    ]);
  });

  it('refuses the same pair and kind again, from either end, and a self link', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    await expect(
      work.services.links.create(member, blocked.key, {
        targetId: blocker.id,
        kind: 'blocks',
        inverse: true,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      work.services.links.create(member, blocked.key, { targetId: blocker.id, kind: 'blocks' }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      work.services.links.create(member, blocker.key, { targetId: blocker.id, kind: 'relates' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const relates = await work.services.links.create(member, blocked.key, {
      targetId: blocker.id,
      kind: 'relates',
    });
    expect(relates).toMatchObject({ sourceId: blocked.id, targetId: blocker.id });
  });

  it('records "is blocked by" from the target as the blocks row it is', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const a = await work.issue(project, 'Ship the API');
    const b = await work.issue(project, 'Write the client');
    const link = await work.services.links.create(admin, b.key, {
      targetId: a.id,
      kind: 'blocks',
      inverse: true,
    });
    expect(link).toMatchObject({ sourceId: a.id, targetId: b.id });
    await work.services.links.remove(admin, link.id);
    expect(await work.services.links.list(admin, a.key)).toEqual([]);
    expect((await work.services.issues.get(admin, b.key)).links).toEqual([]);
  });

  it('needs view on the far project to link across projects', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const elsewhere = await work.project('FAR');
    const hidden = await work.issue(elsewhere, 'Not yours to see');
    await expect(
      work.services.links.create(work.as(work.users.member), blocker.key, {
        targetId: hidden.id,
        kind: 'relates',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const across = await work.services.links.create(work.as(work.users.admin), blocker.key, {
      targetId: hidden.id,
      kind: 'relates',
    });
    expect(across.targetId).toBe(hidden.id);
  });
});
