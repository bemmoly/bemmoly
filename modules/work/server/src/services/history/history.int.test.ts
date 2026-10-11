import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('issue history against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('HIST', [work.users.member]);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('writes one row per changed field, from and to, by whoever changed it', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const label = await work.services.labels.create(admin, 'HIST', { name: 'backend' });
    const issue = await work.issue(project, 'Original title');
    await work.services.issues.update(work.as(work.users.member), issue.key, {
      title: 'Better title',
      priority: 'high',
      assigneeId: work.users.member,
      estimate: 5,
      labelIds: [label.id],
      description: { type: 'doc', content: [] },
    });
    const page = await work.services.history.list(admin, issue.key, { limit: 50 });
    const rows = page.items.map((entry) => [entry.field, entry.from, entry.to, entry.actorId]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ['title', 'Original title', 'Better title', work.users.member],
        ['priority', 'medium', 'high', work.users.member],
        ['assigneeId', null, work.users.member, work.users.member],
        ['estimate', null, 5, work.users.member],
        ['labelIds', [], [label.id], work.users.member],
        ['description', null, null, work.users.member],
        ['created', null, issue.key, work.users.admin],
      ]),
    );
    expect(rows).toHaveLength(7);
    expect(page.items.at(-1)?.field).toBe('created');
  });

  it('writes nothing for a PATCH that changes nothing, and filters by field', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const issue = await work.issue(project, 'Steady', { priority: 'low' });
    await work.services.issues.update(admin, issue.key, { title: 'Steady', priority: 'low' });
    await work.services.issues.update(admin, issue.key, { priority: 'highest' });
    await work.services.issues.update(admin, issue.key, { priority: 'lowest' });
    const all = await work.services.history.list(admin, issue.key, { limit: 50 });
    expect(all.items.map((entry) => entry.field)).toEqual(['priority', 'priority', 'created']);
    const first = await work.services.history.list(admin, issue.key, {
      limit: 1,
      field: 'priority',
    });
    expect(first.items.map((entry) => entry.to)).toEqual(['lowest']);
    const next = await work.services.history.list(admin, issue.key, {
      limit: 1,
      field: 'priority',
      cursor: first.nextCursor ?? undefined,
    });
    expect(next.items.map((entry) => entry.to)).toEqual(['highest']);
  });
});
