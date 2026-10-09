import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { createIssueSearchProvider } from './index.ts';

describe('the Work palette provider against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let first: Issue;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    const project = await work.project('PAL', [work.users.member]);
    const hidden = await work.project('HID');
    first = await work.issue(project, 'Rotate service tokens', { assigneeId: work.users.member });
    for (let index = 2; index <= 12; index += 1) await work.issue(project, `Chore ${index}`);
    await work.issue(project, 'Mentions PAL-1 in passing');
    await work.issue(hidden, 'Rotate the hidden tokens');
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  const provider = () => createIssueSearchProvider(work.services.search, work.sql);

  it('answers a key with that issue first, its status and assignee, and a link', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const results = await provider().search(work.as(work.users.member), { q: 'pal-1', limit: 8 });
    expect(results[0]).toEqual({
      id: first.id,
      key: 'PAL-1',
      title: 'Rotate service tokens',
      subtitle: 'Backlog · mo',
      href: '/work/issues/PAL-1',
    });
    expect(results.map((result) => result.key)).toEqual(
      expect.arrayContaining(['PAL-10', 'PAL-11', 'PAL-12']),
    );
    expect(new Set(results.map((result) => result.id)).size).toBe(results.length);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('answers words by keyword, only from projects the person is in', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = await provider().search(work.as(work.users.member), { q: 'rotate', limit: 8 });
    expect(member.map((result) => result.key)).toEqual(['PAL-1']);
    const admin = await provider().search(work.as(work.users.admin), { q: 'rotate', limit: 8 });
    expect(admin.map((result) => result.key).sort()).toEqual(['HID-1', 'PAL-1']);
    const outsider = await provider().search(work.as(work.users.outsider), {
      q: 'rotate',
      limit: 8,
    });
    expect(outsider).toEqual([]);
  });
});
