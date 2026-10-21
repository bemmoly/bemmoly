import { ValidationError } from '@bemmoly/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { automationFixture as fixture, type AutomationFixture } from './automation-support.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('time-in-status rules against Postgres', () => {
  let h: WorkHarness;
  let skip = '';
  let n = 0;

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (!started.available) skip = started.reason;
    else h = started.harness;
  });
  afterAll(async () => h?.stop());

  const listening: AutomationFixture[] = [];
  afterEach(() => {
    for (const f of listening.splice(0)) f.stop();
  });
  const automationFixture = () => {
    const f = fixture(h);
    listening.push(f);
    return f;
  };

  const project = (): Promise<Project> => h.project(`TS${(n += 1)}`);

  /** Puts the issue in a status of its own workflow, entered some days before `now`. */
  async function sitIn(issue: Issue, status: string, daysAgo: number, now: Date) {
    const entered = new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
    await h.sql`
      update issues set status_id = (
        select s.id from workflow_statuses s
        where s.workflow_id = (select workflow_id from workflow_statuses where id = ${issue.statusId})
          and s.name = ${status}),
        status_changed_at = ${entered}
      where id = ${issue.id}`;
  }

  const statusOf = async (key: string) =>
    (await h.services.issues.get(h.as(h.users.admin), key)).status.name;

  it('moves an issue that sat in a status too long, once per stay', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture();
    const plt = await project();
    const rule = await f.rule({
      name: 'Close stale testing',
      projectId: plt.id,
      enabled: true,
      trigger: { name: 'time_in_status', args: { status: 'Testing', amount: 5, unit: 'days' } },
      conditions: ['priority = high'],
      actions: [{ name: 'transition', args: { status: 'Done' } }],
    });
    const now = new Date();
    const stale = await h.issue(plt, 'Stale', { priority: 'high' });
    const fresh = await h.issue(plt, 'Fresh', { priority: 'high' });
    const low = await h.issue(plt, 'Low', { priority: 'low' });
    await sitIn(stale, 'Testing', 6, now);
    await sitIn(fresh, 'Testing', 2, now);
    await sitIn(low, 'Testing', 6, now);

    expect(await h.services.automation.tick(now)).toBe(1);
    expect(await h.services.automation.tick(now)).toBe(0);
    expect(await f.drain()).toBe(1);
    expect(await statusOf(stale.key)).toBe('Done');
    expect(await statusOf(fresh.key)).toBe('Testing');
    expect(await statusOf(low.key)).toBe('Testing');
    const [run] = await f.runs(rule.id);
    expect(run).toMatchObject({ status: 'succeeded', trigger: 'time_in_status' });
    expect(run?.issueKey).toBe(stale.key);

    // A stay whose conditions match later still fires, once.
    await h.services.issues.update(h.as(h.users.admin), low.key, { priority: 'high' });
    await sitIn(low, 'Testing', 6, now);
    expect(await h.services.automation.tick(now)).toBe(1);
    expect(await h.services.automation.tick(now)).toBe(0);
  });

  it('fires again after the issue leaves the status and comes back', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture();
    const plt = await project();
    const rule = await f.rule({
      name: 'Nag in review',
      projectId: plt.id,
      enabled: true,
      trigger: {
        name: 'time_in_status',
        args: { status: 'code review', amount: 4, unit: 'hours' },
      },
      actions: [{ name: 'add_comment', args: { body: 'Still in review' } }],
    });
    const now = new Date();
    const issue = await h.issue(plt, 'Long review');
    await sitIn(issue, 'Code review', 1, now);
    expect(await h.services.automation.tick(now)).toBe(1);
    await sitIn(issue, 'Code review', 0.5, now);
    expect(await h.services.automation.tick(now)).toBe(1);
    await f.drain();
    expect(await f.runs(rule.id)).toHaveLength(2);
  });

  it('refuses a duration that is not a whole positive number', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture();
    const plt = await project();
    await expect(
      f.rule({
        name: 'Broken',
        projectId: plt.id,
        trigger: { name: 'time_in_status', args: { status: 'Testing', amount: 0, unit: 'days' } },
        actions: [{ name: 'add_label', args: { label: 'x' } }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
