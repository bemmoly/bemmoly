import { createAuditRecorder } from '@bemmoly/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { automationFixture as fixture, type AutomationFixture } from './automation-support.ts';
import { stoppedMessage } from './engine.ts';
import { createAutomationService } from './index.ts';

const setPriority = (priority: string) => ({
  name: 'set_field',
  args: { field: 'priority', value: priority },
});
const onPriority = { name: 'field_changed', args: { fields: ['priority'] } };

describe('automation loop protection and schedules against Postgres', () => {
  let h: WorkHarness;
  let skip = '';
  let n = 0;

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (!started.available) skip = started.reason;
    else h = started.harness;
  });
  afterAll(async () => h?.stop());

  // One engine listens at a time, even when a test fails half way.
  const listening: AutomationFixture[] = [];
  afterEach(() => {
    for (const f of listening.splice(0)) f.stop();
  });
  const automationFixture = (...args: Parameters<typeof fixture>) => {
    const f = fixture(...args);
    listening.push(f);
    return f;
  };

  const project = (): Promise<Project> => h.project(`LP${(n += 1)}`);

  it('never lets a rule’s own action trigger it again', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture(h);
    const plt = await project();
    const rule = await f.rule({
      name: 'Keep it high',
      projectId: plt.id,
      enabled: true,
      trigger: onPriority,
      actions: [setPriority('high')],
    });
    const issue = await h.issue(plt, 'Flaky test');
    await h.services.issues.update(h.as(h.users.admin), issue.key, { priority: 'low' });
    expect(await f.drain()).toBe(1);
    expect((await h.services.issues.get(h.as(h.users.admin), issue.key)).priority).toBe('high');
    expect(await f.runs(rule.id)).toHaveLength(1);
  });

  it('ends a ping-pong between two rules: no rule runs on a chain it is already in', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture(h);
    const plt = await project();
    const up = await f.rule({
      name: 'Up',
      projectId: plt.id,
      enabled: true,
      trigger: onPriority,
      actions: [setPriority('highest')],
    });
    const down = await f.rule({
      name: 'Down',
      projectId: plt.id,
      enabled: true,
      trigger: onPriority,
      actions: [setPriority('lowest')],
    });
    const issue = await h.issue(plt, 'Contested');
    await h.services.issues.update(h.as(h.users.admin), issue.key, { priority: 'low' });
    const ran = await f.drain();
    expect(ran).toBeLessThanOrEqual(4);
    const runs = [...(await f.runs(up.id)), ...(await f.runs(down.id))];
    for (const run of runs) {
      expect(run.input['chain']).not.toContain(run.ruleId);
      expect(run.depth).toBe((run.input['chain'] as string[]).length);
    }
    expect(runs.some((run) => run.depth === 1)).toBe(true);
  });

  it('stops a chain at the depth limit with a skipped run that says why', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const shallow = createAutomationService({
      database: h.sql,
      audit: createAuditRecorder(h.sql),
      events: h.bus,
      jobs: {
        send: async (name, payload) => {
          h.jobs.push({ name, payload });
          return name;
        },
      },
      contextFor: h.context,
      lql: h.services.lql,
      services: {
        issues: h.services.issues,
        comments: h.services.comments,
        labels: h.services.labels,
        workflow: h.services.workflow,
        events: h.bus,
        notify: async () => undefined,
      },
      maxDepth: 1,
    });
    const f = automationFixture(h, shallow);
    const plt = await project();
    await f.rule({
      name: 'First',
      projectId: plt.id,
      enabled: true,
      trigger: onPriority,
      actions: [{ name: 'add_label', args: { label: 'seen' } }],
    });
    const second = await f.rule({
      name: 'Second',
      projectId: plt.id,
      enabled: true,
      trigger: { name: 'field_changed', args: { fields: ['labelIds'] } },
      actions: [{ name: 'add_comment', args: { body: 'Labelled' } }],
    });
    const issue = await h.issue(plt, 'Chained');
    await h.services.issues.update(h.as(h.users.admin), issue.key, { priority: 'high' });
    await f.drain();
    const [stopped] = await f.runs(second.id);
    expect(stopped).toMatchObject({
      status: 'skipped',
      depth: 1,
      issueKey: issue.key,
      error: stoppedMessage(1),
    });
    expect(stoppedMessage(5)).toBe('Stopped to prevent a loop: 5 rules in a row led to this run');
  });

  it('runs a scheduled rule once per fire time, on the issues its filter matches', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const f = automationFixture(h);
    const plt = await project();
    const rule = await f.rule({
      name: 'Nag about blockers',
      projectId: plt.id,
      enabled: true,
      trigger: { name: 'scheduled', args: { cron: '0 * * * *' } },
      conditions: ['priority = highest'],
      actions: [{ name: 'add_label', args: { label: 'nagged' } }],
    });
    await h.sql`
      update automation_rules set updated_at = '2026-10-11T07:30:00Z' where id = ${rule.id}`;
    const hot = await h.issue(plt, 'Blocker', { priority: 'highest' });
    const cold = await h.issue(plt, 'Nice to have', { priority: 'low' });
    const at = (iso: string) => h.services.automation.tick(new Date(iso));
    expect(await at('2026-10-11T09:10:00Z')).toBe(1);
    expect(await at('2026-10-11T09:40:00Z')).toBe(0);
    await f.drain();
    const [run] = await f.runs(rule.id);
    expect(run).toMatchObject({
      status: 'succeeded',
      trigger: 'schedule',
      issueKey: null,
      result: { conditionsMet: true, issueCount: 1 },
      input: { scheduledFor: '2026-10-11T09:00:00.000Z' },
    });
    const labelled = await h.sql<{ key: string }[]>`
      select i.key from issue_labels il join issues i on i.id = il.issue_id
      join labels l on l.id = il.label_id where l.name = 'nagged'`;
    expect(labelled.map((row) => row.key)).toEqual([hot.key]);
    expect(labelled.map((row) => row.key)).not.toContain(cold.key);
    expect(await at('2026-10-11T10:00:00Z')).toBe(1);
    await h.sql`update automation_rules set enabled = false where id = ${rule.id}`;
  });
});
