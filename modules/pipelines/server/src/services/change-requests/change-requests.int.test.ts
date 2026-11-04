import type { DomainEvent, SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changeRequestDetailSchema } from '../../../../shared/change-requests.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { createChangeRequestsService, type ChangeRequestsService } from './index.ts';

/*
 * Change requests against real Postgres and the fake cloud: the route built from the
 * environment's rule and the risk, picks checked against the groups, ordered steps, the last
 * approval starting the deploy by itself, the deploy window holding it, and the request
 * following its promotions to deployed. Groups and the rule are written straight to the
 * tables, as Platform › Approval rules would.
 */

describe('change requests', () => {
  let harness: PipelinesHarness | undefined;
  let f: ShippingFixture;
  let service: ChangeRequestsService;
  let reason = '';
  let ananya = '';
  const told: DomainEvent[] = [];
  const PROD = 'prod-asia-south1';

  const sql = (): SqlClient => {
    if (!harness) throw new Error('No database');
    return harness.sql;
  };
  const as = (id: string) => harness?.as(id) ?? ({} as never);
  const priya = () => as(harness?.users.member ?? '');

  async function person(email: string, name: string): Promise<string> {
    const [row] = await sql()<{ id: string }[]>`insert into users (email, name, role_id)
      select ${email}, ${name}, id from roles where key = 'member' returning id`;
    if (!row) throw new Error('no user');
    await sql()`insert into module_grants (module_id, subject_kind, subject_id)
      values ('pipelines', 'user', ${row.id})`;
    return row.id;
  }

  async function group(name: string, members: string[]): Promise<string> {
    const [row] = await sql()<{ id: string }[]>`
      insert into pipeline_approval_groups (name) values (${name}) returning id`;
    if (!row) throw new Error('no group');
    for (const user of members) {
      await sql()`insert into pipeline_approval_group_members (group_id, user_id)
        values (${row.id}, ${user})`;
    }
    return row.id;
  }

  async function passedStaging(version: string): Promise<string> {
    const release = await f.release(version);
    for (const to of ['dev', 'staging']) {
      const { promotion } = await f.service.requestPromotion(priya(), {
        release,
        to,
        mode: 'continuous',
      });
      const done = await f.runUntil(async () => {
        const [row] = await sql()<{ state: string }[]>`
          select state from pipeline_promotions where id = ${promotion.id}`;
        return row?.state === 'succeeded';
      }, 30);
      expect(done).toBe(true);
    }
    return release;
  }

  const body = (releaseId: string, picks: Array<{ step: number; users: string[] }>) => ({
    environment: PROD,
    title: 'Retry failed checkouts',
    why: 'Fewer failed checkouts when the payment provider is slow',
    risk: 'high' as const,
    when: { kind: 'asap' as const },
    rollback: 'Roll back to the previous version',
    items: [{ application: 'checkout-api', releaseId }],
    picks,
    send: true,
  });

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
    ananya = await person('ananya@example.test', 'Ananya Iyer');
    const approvers = await group('Production approvers', [f.ravi, ananya, harness.users.member]);
    const highRisk = await group('High-risk approvers', [ananya]);
    await sql()`update pipeline_environments set versions_allowed = 'passed_previous',
      approval_rule = ${JSON.stringify({
        steps: [
          { group: approvers, count: 2, when: 'always' },
          { group: highRisk, count: 1, when: 'high_risk' },
        ],
      })}::jsonb
      where key = ${PROD}`;
    service = createChangeRequestsService({
      sql: sql(),
      now: () => f.clock.now,
      shipping: f.service,
      events: { publish: async (event) => void told.push(event) },
    });
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('offers the route at each risk, never the person asking', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const low = await service.options(priya(), { environment: PROD, risk: 'low' });
    expect(low.needsChangeRequest).toBe(true);
    expect(low.steps.map((s) => s.applies)).toEqual([true, false]);
    expect(low.steps[0]?.candidates.map((c) => c.name)).toEqual(['Ananya Iyer', 'Ravi Kumar']);
    const high = await service.options(priya(), { environment: PROD, risk: 'high' });
    expect(high.steps.every((s) => s.applies)).toBe(true);
  });

  it('sends a direct deploy to an environment with a rule back to a change request', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const release = await passedStaging('v1.0.0');
    await expect(
      f.service.requestPromotion(priya(), { release, to: PROD, mode: 'continuous' }),
    ).rejects.toThrow(/change request/);
  });

  it('refuses picks that break the rule', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [release] = await sql()<{ id: string }[]>`
      select id from pipeline_releases where version = 'v1.0.0'`;
    const id = release?.id ?? '';
    const me = harness.users.member;
    await expect(
      service.create(
        priya(),
        body(id, [
          { step: 0, users: [f.ravi, me] },
          { step: 1, users: [ananya] },
        ]),
      ),
    ).rejects.toThrow(/own change/);
    await expect(
      service.create(
        priya(),
        body(id, [
          { step: 0, users: [f.ravi] },
          { step: 1, users: [ananya] },
        ]),
      ),
    ).rejects.toThrow(/pick 1 more/);
    await expect(
      service.create(
        priya(),
        body(id, [
          { step: 0, users: [f.ravi, ananya] },
          { step: 1, users: [f.ravi] },
        ]),
      ),
    ).rejects.toThrow(/not in it/);
    const untested = await f.release('v1.0.1');
    await expect(
      service.create(
        priya(),
        body(untested, [
          { step: 0, users: [f.ravi, ananya] },
          { step: 1, users: [ananya] },
        ]),
      ),
    ).rejects.toThrow(/passed Staging/);
  });

  it('goes step by step and deploys itself after the last approval', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [release] = await sql()<{ id: string }[]>`
      select id from pipeline_releases where version = 'v1.0.0'`;
    const sent = await service.create(
      priya(),
      body(release?.id ?? '', [
        { step: 0, users: [f.ravi, ananya] },
        { step: 1, users: [ananya] },
      ]),
    );
    expect(changeRequestDetailSchema.parse(sent).status).toBe('waiting');
    expect(sent.number).toMatch(/^CHG-1\d{3}$/);
    expect(sent.steps.map((s) => s.state)).toEqual(['waiting', 'queued']);
    expect(told.at(-1)?.payload).toMatchObject({ kind: 'review_request' });

    await expect(service.approve(priya(), sent.number, null)).rejects.toThrow(/own change/);
    const one = await service.approve(as(f.ravi), sent.number, 'Read the retry code');
    expect(one.steps[0]?.approvals).toHaveLength(1);
    await expect(service.approve(as(f.ravi), sent.number, null)).rejects.toThrow(/already/);
    const listed = await service.list(as(ananya), { tab: 'waiting_for_me', limit: 50 });
    expect(listed.items.map((i) => [i.number, i.approvalsGot, i.approvalsNeeded])).toEqual([
      [sent.number, 1, 2],
    ]);

    const two = await service.approve(as(ananya), sent.number, null);
    expect(two.steps.map((s) => s.state)).toEqual(['approved', 'waiting']);
    const done = await service.approve(as(ananya), sent.number, 'Fine at high risk');
    expect(done.status).toBe('deploying');
    expect(done.deploys).toHaveLength(1);

    const deployed = await f.runUntil(
      async () => (await service.get(priya(), sent.number)).status === 'deployed',
      60,
    );
    expect(deployed).toBe(true);
    const [current] = await sql()<{ version: string }[]>`
      select c.version from pipeline_current c join pipeline_environments e on e.id = c.environment_id
      where e.key = ${PROD}`;
    expect(current?.version).toBe('v1.0.0');
    const after = await service.get(priya(), sent.number);
    expect(after.activity.map((a) => a.text)).toContain('Deployed to Prod · asia-south1.');
  });

  it('hands a request back for changes, then a rejection ends it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const release = await passedStaging('v1.1.0');
    const low = { ...body(release, [{ step: 0, users: [f.ravi, ananya] }]), risk: 'low' as const };
    const sent = await service.create(priya(), low);
    expect(sent.skipped.map((s) => s.group.name)).toEqual(['High-risk approvers']);
    const back = await service.reject(as(f.ravi), sent.number, {
      kind: 'changes_requested',
      note: 'Add the rollback steps',
    });
    expect(back.status).toBe('changes_requested');
    expect(back.can).toMatchObject({ approve: false });
    const edited = await service.update(priya(), sent.number, { rollback: 'Roll back to v1.0.0' });
    expect(edited.rollback).toBe('Roll back to v1.0.0');
    const again = await service.send(priya(), sent.number);
    expect(again.status).toBe('waiting');
    const rejected = await service.reject(as(ananya), sent.number, {
      kind: 'reject',
      note: 'Not this week',
    });
    expect(rejected.status).toBe('rejected');
    await expect(service.withdraw(priya(), sent.number, null)).rejects.toThrow(/no longer/);
  });

  it('waits for the deploy window, then starts on the sweep', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const release = await passedStaging('v1.2.0');
    const hour = f.clock.now.getUTCHours();
    const open = `${String((hour + 2) % 24).padStart(2, '0')}:00`;
    const close = `${String((hour + 4) % 24).padStart(2, '0')}:00`;
    await sql()`update pipeline_environments set deploy_window = ${JSON.stringify({
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      from: open,
      to: close,
      timeZone: 'UTC',
    })}::jsonb where key = ${PROD}`;
    const low = { ...body(release, [{ step: 0, users: [f.ravi, ananya] }]), risk: 'low' as const };
    const sent = await service.create(priya(), low);
    await service.approve(as(f.ravi), sent.number, null);
    const approved = await service.approve(as(ananya), sent.number, null);
    expect(approved.status).toBe('approved');
    expect(await service.sweep()).toBe(0);
    f.clock.advance(150 * 60_000);
    expect(await service.sweep()).toBe(1);
    expect((await service.get(priya(), sent.number)).status).toBe('deploying');
    await sql()`update pipeline_environments set deploy_window = null where key = ${PROD}`;
  });

  it('lets only a Platform admin deploy without approval, and tells the approvers', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const release = await passedStaging('v1.3.0');
    const emergency = {
      ...body(release, []),
      emergency: { reason: 'Checkout is down for every buyer' },
    };
    await expect(service.create(priya(), emergency)).rejects.toThrow();
    const before = told.length;
    const created = await service.create(as(harness.users.admin), emergency);
    expect(created.emergencyReason).toBe('Checkout is down for every buyer');
    expect(created.status).toBe('deploying');
    const notice = told
      .slice(before)
      .find((e) => (e.payload as { kind: string }).kind === 'pipelines.emergency_deploy');
    expect((notice?.payload as { recipientIds: string[] }).recipientIds.sort()).toEqual(
      [f.ravi, ananya, harness.users.member].sort(),
    );
  });
});
