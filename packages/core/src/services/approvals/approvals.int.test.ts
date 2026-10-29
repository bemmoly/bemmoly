import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import type { WorkflowSpecInput } from '@bemmoly/shared/approvals';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startApprovalsHarness, type ApprovalsHarness } from '../../testing/approvals-harness.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { APPROVAL_ESCALATE_JOB } from './context.ts';

describe('the approval engine against Postgres', () => {
  let database: TestDatabase;
  let h: ApprovalsHarness;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (database.available) h = await startApprovalsHarness(database);
  });
  afterAll(async () => {
    if (!database.available) return;
    await h.stop();
    await database.stop();
  });
  beforeEach(async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    await h.reset();
    h.org.managers.set(h.ids.requester, h.ids.manager);
    h.org.managers.set(h.ids.manager, h.ids.director);
  });

  const claims: WorkflowSpecInput = {
    autoApprove: [[{ field: 'amount', op: 'lt', value: 50 }]],
    stages: [
      { name: 'Manager', approvers: [{ type: 'manager', levels: 1 }] },
      {
        name: 'Finance',
        when: [{ field: 'amount', op: 'gt', value: 500 }],
        approvers: [{ type: 'role', roleKey: 'project_admin' }],
      },
    ],
  };
  const define = (spec: WorkflowSpecInput = claims) =>
    h.service.workflows.save(h.as('admin'), {
      moduleId: 'expenses',
      key: 'expenses.claim',
      name: 'Expense claims',
      spec,
    });
  const claim = (amount: number, id = 'c-1') =>
    h.service.start(h.as('requester'), {
      moduleId: 'expenses',
      workflowKey: 'expenses.claim',
      subject: { kind: 'claim', id },
      title: `Claim ${id}`,
      fields: { amount },
    });
  const kinds = () => h.published.map((event) => event.kind);
  const waitingFor = async (person: Parameters<ApprovalsHarness['as']>[0]) =>
    (await h.service.list(h.as(person))).items.map((item) => item.id);

  it('runs stages in order, skipping one whose conditions fail', async () => {
    await define();
    const big = await claim(640);
    expect(big.status).toBe('pending');
    expect(big.currentStage).toBe(0);
    expect(await waitingFor('manager')).toEqual([big.id]);
    await expect(
      h.service.decide(h.as('requester'), big.id, { decision: 'approve' }),
    ).rejects.toThrow(ForbiddenError);
    const atFinance = await h.service.decide(h.as('manager'), big.id, {
      decision: 'approve',
      comment: 'Looks right',
    });
    expect(atFinance.currentStage).toBe(1);
    expect(await waitingFor('manager')).toEqual([]);
    expect(await waitingFor('finance')).toEqual([big.id]);
    const done = await h.service.decide(h.as('finance'), big.id, { decision: 'approve' });
    expect(done.status).toBe('approved');
    expect(done.tasks.map((t) => [t.approverId, t.status, t.comment])).toEqual([
      [h.ids.manager, 'approved', 'Looks right'],
      [h.ids.finance, 'approved', null],
    ]);
    expect(kinds()).toContain('approval.approved');

    const small = await claim(120, 'c-2');
    const approved = await h.service.decide(h.as('manager'), small.id, { decision: 'approve' });
    expect(approved.status).toBe('approved');
    expect(approved.tasks).toHaveLength(1);
  });

  it('audits, notifies and publishes each step in its transaction', async () => {
    await define();
    const started = await claim(640);
    await h.service.decide(h.as('manager'), started.id, {
      decision: 'reject',
      comment: 'No receipt',
    });
    const audit = await h.sql<{ action: string }[]>`
      select action from audit_log where target_id = ${started.id} order by id`;
    expect(audit.map((row) => row.action)).toEqual([
      'approval.requested',
      'approval.decided',
      'approval.rejected',
    ]);
    const notices = h.published.filter((event) => event.kind === 'notification.requested');
    expect(notices.map((event) => (event.payload as { kind: string }).kind)).toEqual([
      'approval_requested',
      'approval_decided',
    ]);
    expect(kinds()).toEqual(expect.arrayContaining(['approval.requested', 'approval.rejected']));
    const rejected = h.published.find((event) => event.kind === 'approval.rejected');
    expect(rejected?.payload).toMatchObject({
      moduleId: 'expenses',
      subject: { kind: 'claim', id: 'c-1' },
      status: 'rejected',
    });
    expect(rejected?.transaction).toBeDefined();
  });

  it('auto-approves when a rule matches, with no task at all', async () => {
    await define();
    const tiny = await claim(20);
    expect(tiny).toMatchObject({ status: 'approved', autoApproved: true, tasks: [] });
  });

  it('lets only the requester withdraw, once, and refuses decisions after', async () => {
    await define();
    const started = await claim(640);
    await expect(h.service.withdraw(h.as('manager'), started.id)).rejects.toThrow(ForbiddenError);
    const withdrawn = await h.service.withdraw(h.as('requester'), started.id, {
      comment: 'Wrong trip',
    });
    expect(withdrawn.status).toBe('withdrawn');
    expect(withdrawn.tasks.every((t) => t.status === 'cancelled')).toBe(true);
    await expect(h.service.withdraw(h.as('requester'), started.id)).rejects.toThrow(ConflictError);
    await expect(
      h.service.decide(h.as('manager'), started.id, { decision: 'approve' }),
    ).rejects.toThrow(ConflictError);
    const again = await claim(640);
    expect(again.id).not.toBe(started.id);
    await expect(claim(640)).rejects.toThrow(ConflictError);
  });

  it('waits for everyone in an all-approve stage', async () => {
    await define({
      stages: [
        {
          name: 'Both',
          mode: 'all',
          approvers: [
            { type: 'user', userId: h.ids.manager },
            { type: 'user', userId: h.ids.director },
          ],
        },
      ],
    });
    await h.service.setDelegation(h.as('director'), {
      delegateId: h.ids.manager,
      startsAt: new Date('2026-10-20T00:00:00Z'),
      endsAt: new Date('2026-10-30T00:00:00Z'),
    });
    const started = await claim(640);
    expect(started.tasks.map((t) => t.approverId)).toEqual([h.ids.manager, h.ids.director]);
    await expect(
      h.service.decide({ kind: 'api_token', id: 'token-1', userId: h.ids.manager }, started.id, {
        decision: 'approve',
      }),
    ).rejects.toThrow(ForbiddenError);
    const half = await h.service.decide(h.as('manager'), started.id, { decision: 'approve' });
    expect(half.status).toBe('pending');
    const done = await h.service.decide(h.as('director'), started.id, { decision: 'approve' });
    expect(done.status).toBe('approved');
  });

  it('hands a task to the delegate of someone away, and N levels up resolves', async () => {
    await define({ stages: [{ name: 'Skip level', approvers: [{ type: 'manager', levels: 2 }] }] });
    await h.service.setDelegation(h.as('director'), {
      delegateId: h.ids.delegate,
      startsAt: new Date('2026-10-20T00:00:00Z'),
      endsAt: new Date('2026-10-30T00:00:00Z'),
    });
    const started = await claim(640);
    expect(started.tasks).toMatchObject([
      { approverId: h.ids.delegate, onBehalfOf: h.ids.director },
    ]);
    expect(await waitingFor('director')).toEqual([]);
    expect(await waitingFor('delegate')).toEqual([started.id]);
    expect(await h.service.get(h.as('director'), started.id)).toMatchObject({ id: started.id });
    await expect(
      h.service.setDelegation(h.as('director'), {
        delegateId: h.ids.director,
        startsAt: new Date('2026-10-20T00:00:00Z'),
        endsAt: new Date('2026-10-30T00:00:00Z'),
      }),
    ).rejects.toThrow(ValidationError);
    await h.service.clearDelegation(h.as('director'));
    expect(await h.service.delegation(h.as('director'))).toBeNull();
  });

  it('escalates once an SLA passes and lets the escalation approver decide', async () => {
    await define({
      stages: [
        {
          name: 'Manager',
          approvers: [{ type: 'manager', levels: 1 }],
          sla: { hours: 24, escalateTo: { type: 'user', userId: h.ids.director } },
        },
      ],
    });
    const started = await claim(640);
    const [job] = h.jobs.queued;
    expect(job?.name).toBe(APPROVAL_ESCALATE_JOB);
    expect(job?.options.startAfter).toEqual(new Date('2026-10-23T09:00:00.000Z'));
    await h.jobs.runAll(APPROVAL_ESCALATE_JOB);
    const escalated = await h.service.get(h.as('requester'), started.id);
    expect(escalated.status).toBe('escalated');
    expect(escalated.tasks.map((t) => [t.approverId, t.escalation])).toEqual([
      [h.ids.manager, false],
      [h.ids.director, true],
    ]);
    expect(kinds()).toContain('approval.escalated');
    const done = await h.service.decide(h.as('director'), started.id, { decision: 'approve' });
    expect(done.status).toBe('approved');
  });

  it('refuses a stage nobody can approve and writes nothing', async () => {
    await define();
    h.org.managers.clear();
    await expect(claim(640)).rejects.toThrow(ValidationError);
    const [count] = await h.sql<{ n: number }[]>`select count(*)::int as n from approval_requests`;
    expect(count?.n).toBe(0);
  });

  it('keeps a running request on the version it started with', async () => {
    await define();
    const started = await claim(640);
    const v2 = await define({
      stages: [{ name: 'Director', approvers: [{ type: 'user', userId: h.ids.director }] }],
    });
    expect(v2.version).toBe(2);
    const after = await h.service.decide(h.as('manager'), started.id, { decision: 'approve' });
    expect(after).toMatchObject({ workflowVersion: 1, currentStage: 1 });
  });

  it('shows a request to those on it and to admins, and definitions only to admins', async () => {
    await define();
    const started = await claim(640);
    await expect(h.service.get(h.as('delegate'), started.id)).rejects.toThrow(ForbiddenError);
    expect((await h.service.get(h.as('admin'), started.id)).id).toBe(started.id);
    await expect(h.service.workflows.list(h.as('requester'))).rejects.toThrow(ForbiddenError);
    expect((await h.service.list(h.as('requester'), { scope: 'mine' })).items).toHaveLength(1);
    expect(await h.service.forSubject('expenses', { kind: 'claim', id: 'c-1' })).toHaveLength(1);
  });

  it('keeps reads and delegations to people, not tokens acting for them', async () => {
    await define();
    const started = await claim(640);
    const token = { kind: 'api_token', id: 'token-1', userId: h.ids.requester } as const;
    await expect(h.service.get(token, started.id)).rejects.toThrow(ForbiddenError);
    await expect(h.service.list(token, { scope: 'mine' })).rejects.toThrow(ForbiddenError);
    await expect(
      h.service.setDelegation(token, {
        delegateId: h.ids.manager,
        startsAt: new Date('2026-10-20T00:00:00Z'),
        endsAt: new Date('2026-10-30T00:00:00Z'),
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
