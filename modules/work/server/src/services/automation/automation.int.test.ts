import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import { WEBHOOK_REQUESTED_EVENT } from '@bemmoly/shared/webhooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { automationFixture, type AutomationFixture } from './automation-support.ts';

const label = (name: string) => ({ name: 'add_label', args: { label: name } });

describe('automation rules against Postgres', () => {
  let h: WorkHarness;
  let f: AutomationFixture;
  let plt: Project;
  let ops: Project;
  let skip = '';

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (!started.available) {
      skip = started.reason;
      return;
    }
    h = started.harness;
    f = automationFixture(h);
    plt = await h.project('PLT', [h.users.member]);
    ops = await h.project('OPS', [h.users.member]);
  });
  afterAll(async () => {
    f?.stop();
    await h?.stop();
  });

  const labelsOf = async (key: string) => {
    const rows = await h.sql<{ name: string }[]>`
      select l.name from issue_labels il join labels l on l.id = il.label_id
      join issues i on i.id = il.issue_id where i.key = ${key} order by l.name`;
    return rows.map((row) => row.name);
  };

  it('runs a matching rule’s actions as the automation actor, with audit rows', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const rule = await f.rule({
      name: 'Triage new work',
      projectId: plt.id,
      enabled: true,
      trigger: { name: 'issue_created' },
      actions: [label('triage'), { name: 'add_comment', args: { body: 'Thanks, triaging.' } }],
    });
    const issue = await h.issue(plt, 'Login is slow', {}, h.users.member);
    expect(await f.drain()).toBe(1);

    expect(await labelsOf(issue.key)).toEqual(['triage']);
    const [comment] = await h.sql<{ author_id: string; body_text: string }[]>`
      select author_id, body_text from comments where target_id = ${issue.id}`;
    expect(comment).toEqual({ author_id: h.users.admin, body_text: 'Thanks, triaging.' });

    const [run] = await f.runs(rule.id);
    expect(run).toMatchObject({
      status: 'succeeded',
      trigger: 'issue.created',
      issueKey: issue.key,
      depth: 0,
      error: null,
      result: {
        conditionsMet: true,
        actions: [
          { name: 'add_label', ok: true, message: 'Added the label triage' },
          { name: 'add_comment', ok: true, message: 'Added a comment' },
        ],
      },
    });
    expect(run?.durationMs).toBeGreaterThanOrEqual(0);

    const audit = await h.sql<{ action: string; actor_kind: string; actor_id: string }[]>`
      select action, actor_kind, actor_id from audit_log
      where actor_kind = 'automation' and actor_id = ${rule.id} order by id`;
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining(['label.created', 'automation.add_label', 'automation.add_comment']),
    );
    const [ownerRow] = await h.sql<{ actor_user_id: string }[]>`
      select actor_user_id from audit_log where action = 'automation.add_label'`;
    expect(ownerRow?.actor_user_id).toBe(h.users.admin);
    await h.services.automation.update(h.as(h.users.admin), rule.id, { enabled: false });
  });

  it('checks conditions after the change commits and logs a skipped run when unmet', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const rule = await f.rule({
      name: 'Escalate urgent',
      projectId: plt.id,
      enabled: true,
      trigger: { name: 'issue_created' },
      conditions: ['priority = highest'],
      actions: [label('urgent')],
    });
    const calm = await h.issue(plt, 'Typo on pricing page', { priority: 'low' });
    const fire = await h.issue(plt, 'Checkout is down', { priority: 'highest' });
    await f.drain();
    expect(await labelsOf(calm.key)).toEqual([]);
    expect(await labelsOf(fire.key)).toEqual(['urgent']);
    expect((await f.runs(rule.id)).map((run) => [run.issueKey, run.status])).toEqual([
      [calm.key, 'skipped'],
      [fire.key, 'succeeded'],
    ]);
    await h.services.automation.update(h.as(h.users.admin), rule.id, { enabled: false });
  });

  it('matches field changes and transitions by status name, in every project for global rules', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const moved = await f.rule({
      name: 'Closed means parked',
      enabled: true,
      trigger: { name: 'issue_transitioned', args: { toStatus: "won't do" } },
      actions: [label('parked')],
    });
    const assigned = await f.rule({
      name: 'Assigned work is planned',
      projectId: ops.id,
      enabled: true,
      trigger: { name: 'field_changed', args: { fields: ['assigneeId'] } },
      actions: [label('planned')],
    });
    const a = await h.issue(plt, 'Ship the importer');
    const b = await h.issue(ops, 'Rotate the keys');
    const closed = (key: string) =>
      h.sql<{ id: string }[]>`
        select s.id from workflow_statuses s join issues i on i.key = ${key}
        where s.name = 'Won''t do'
          and s.workflow_id = (select workflow_id from workflow_statuses where id = i.status_id)`;
    for (const issue of [a, b]) {
      const [status] = await closed(issue.key);
      await h.services.issues.update(h.as(h.users.admin), issue.key, { statusId: status!.id });
    }
    await h.services.issues.assign(h.as(h.users.admin), a.key, h.users.member);
    await h.services.issues.assign(h.as(h.users.admin), b.key, h.users.member);
    await f.drain();
    expect(await labelsOf(a.key)).toEqual(['parked']);
    expect(await labelsOf(b.key)).toEqual(['parked', 'planned']);
    expect((await f.runs(moved.id)).map((run) => run.input['toStatus'])).toEqual([
      "Won't do",
      "Won't do",
    ]);
    expect(await f.runs(assigned.id)).toHaveLength(1);
    for (const id of [moved.id, assigned.id]) {
      await h.services.automation.update(h.as(h.users.admin), id, { enabled: false });
    }
  });

  it('lets project admins manage their rules, org admins global ones, and nobody else', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const body = {
      name: 'Mine',
      projectId: plt.id,
      trigger: { name: 'issue_created' },
      actions: [label('x')],
    };
    await expect(f.rule(body, h.users.member)).rejects.toBeInstanceOf(ForbiddenError);
    await h.sql`
      update project_members set role_id = (select id from roles where key = 'project_admin')
      where project_id = ${plt.id} and user_id = ${h.users.member}`;
    const own = await f.rule(body, h.users.member);
    await expect(f.rule({ ...body, projectId: null }, h.users.member)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(f.rule({ ...body, projectId: ops.id }, h.users.member)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      h.services.automation.list(h.as(h.users.outsider), { projectId: plt.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await h.services.automation.remove(h.as(h.users.member), own.id);
    const actions = await h.sql<{ action: string; actor_user_id: string }[]>`
      select action, actor_user_id from audit_log where target_id = ${own.id} order by id`;
    expect(actions).toEqual([
      { action: 'automation_rule.created', actor_user_id: h.users.member },
      { action: 'automation_rule.deleted', actor_user_id: h.users.member },
    ]);
  });

  it('refuses a rule the registries cannot run, with every problem at its path', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const error = await f
      .rule({
        name: 'Broken',
        projectId: plt.id,
        trigger: { name: 'scheduled', args: { cron: 'every day' } },
        conditions: ['priority = = high'],
        actions: [{ name: 'launch_rocket' }, { name: 'assign', args: { to: 'user' } }],
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    const paths = (error as ValidationError).details as { issues: { path: string }[] };
    expect(paths.issues.map((issue) => issue.path)).toEqual([
      'trigger.args.cron',
      'conditions.0',
      'actions.0.name',
      'actions.1.args.userId',
    ]);
  });

  it('acts with its owner’s permissions: a rule cannot do what its owner may not', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const rule = await f.rule({
      name: 'Escalate',
      projectId: ops.id,
      enabled: true,
      trigger: { name: 'issue_created' },
      actions: [label('escalated')],
    });
    await h.sql`update automation_rules set owner_id = ${h.users.outsider} where id = ${rule.id}`;
    const issue = await h.issue(ops, 'Pager storm');
    await f.drain();
    const [run] = await f.runs(rule.id);
    expect(run?.status).toBe('failed');
    expect(run?.error).toMatch(/not a member of this project/);
    expect(await labelsOf(issue.key)).toEqual([]);
    await h.sql`update automation_rules set enabled = false where id = ${rule.id}`;
  });

  it('sends a webhook request and runs a saved rule against one issue on demand', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const webhookId = '0199c7a0-0000-7000-8000-0000000000ab';
    const rule = await f.rule({
      name: 'Tell the deploy bot',
      projectId: plt.id,
      enabled: false,
      trigger: { name: 'comment_added' },
      actions: [{ name: 'send_webhook', args: { webhookId } }],
    });
    const issue = await h.issue(plt, 'Release 0.6');
    const queued = await h.services.automation.test(h.as(h.users.admin), rule.id, {
      issueKey: issue.key,
    });
    expect(queued).toMatchObject({ status: 'queued', trigger: 'test', issueKey: issue.key });
    await f.drain();
    const requested = h.events.filter((event) => event.kind === WEBHOOK_REQUESTED_EVENT);
    expect(requested.at(-1)).toMatchObject({
      actor: { kind: 'automation', id: rule.id, userId: h.users.admin },
      payload: { webhookId, url: `/work/issue/${issue.key}`, data: { rule: { id: rule.id } } },
    });
    await expect(
      h.services.automation.test(h.as(h.users.admin), rule.id, {
        issueKey: (await h.issue(ops, 'Elsewhere')).key,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
