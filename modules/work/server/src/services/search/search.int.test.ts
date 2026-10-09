import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('search against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let open: Project;
  let closed: Project;
  let mine: Issue;
  let theirs: Issue;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    open = await work.project('SRCH', [work.users.member]);
    closed = await work.project('PRIV');
    mine = await work.issue(open, 'Session store migration to Postgres', {
      description: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Backfill 2.1M rows' }] }],
      },
    });
    theirs = await work.issue(closed, 'Session migration for the private project');
    for (let index = 0; index < 10; index += 1) await work.issue(open, `Filler ${index}`);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('ranks keyword hits and shows only projects the person is in', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const asMember = await work.services.search.search(work.as(work.users.member), {
      q: 'migration',
      limit: 20,
    });
    expect(asMember.map((hit) => hit.key)).toEqual([mine.key]);
    expect(asMember[0]?.snippet).toContain('<b>');
    const asAdmin = await work.services.search.search(work.as(work.users.admin), {
      q: 'migration',
      limit: 20,
    });
    expect(asAdmin.map((hit) => hit.key).sort()).toEqual([mine.key, theirs.key].sort());
    const asOutsider = await work.services.search.search(work.as(work.users.outsider), {
      q: 'migration',
      limit: 20,
    });
    expect(asOutsider).toEqual([]);
    await expect(
      work.services.search.search(work.as(work.users.member), {
        q: 'migration',
        projectId: closed.id,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('finds words of the description and follows a renamed title', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    const byBody = await work.services.search.search(member, { q: 'backfill', limit: 20 });
    expect(byBody.map((hit) => hit.key)).toEqual([mine.key]);
    await work.services.issues.update(member, mine.key, { title: 'Session store cutover' });
    const renamed = await work.services.search.search(member, { q: 'cutover', limit: 20 });
    expect(renamed.map((hit) => hit.key)).toEqual([mine.key]);
  });

  it('suggests by key prefix first, case-insensitively, within reach', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    // SRCH-10 changed last; the exact key still comes first.
    await work.services.issues.update(member, 'SRCH-10', { title: 'Filler, touched last' });
    const byKey = await work.services.search.suggest(member, { q: 'srch-1', limit: 8 });
    expect(byKey[0]?.key).toBe('SRCH-1');
    expect(byKey.map((item) => item.key)).toEqual(
      expect.arrayContaining(['SRCH-1', 'SRCH-10', 'SRCH-11']),
    );
    expect(byKey.every((item) => item.key.startsWith('SRCH-1'))).toBe(true);
    const byTitle = await work.services.search.suggest(member, { q: 'session', limit: 8 });
    expect(byTitle.map((item) => item.key)).toEqual([mine.key]);
    const hidden = await work.services.search.suggest(member, { q: 'PRIV', limit: 8 });
    expect(hidden).toEqual([]);
    const wildcard = await work.services.search.suggest(member, { q: '%', limit: 8 });
    expect(wildcard).toEqual([]);
  });
});
