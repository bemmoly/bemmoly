import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPeopleHarness, type PeopleHarness } from '../../testing/harness.ts';

/** A Wednesday, so the weeks below have known working days. */
const TODAY = '2026-11-04';

describe('time off against Postgres', () => {
  let h: PeopleHarness;
  let skip: string | null = null;
  let annual: string;

  beforeAll(async () => {
    const started = await startPeopleHarness(() => new Date(`${TODAY}T10:00:00Z`));
    if (!started.available) {
      skip = started.reason;
      return;
    }
    h = started.harness;
    const admin = h.actor('admin');
    const berlin = await h.kernel.org.createLocation(admin, {
      name: 'Berlin',
      timezone: 'Europe/Berlin',
      countryCode: 'DE',
    });
    await h.kernel.records.create(admin, {
      userId: h.ids.manager,
      state: 'active',
      locationId: berlin.id,
    });
    for (const who of ['ana', 'ben'] as const) {
      await h.kernel.records.create(admin, {
        userId: h.ids[who],
        state: 'active',
        managerId: h.ids.manager,
        locationId: berlin.id,
      });
    }
    annual = (
      await h.services.leave.policies.create(h.as('admin'), {
        name: 'Annual leave',
        kind: 'annual',
        allowanceDays: 10,
      })
    ).id;
    await h.services.leave.policies.create(h.as('admin'), {
      name: 'Sick leave',
      kind: 'sick',
      needsApproval: false,
    });
  });
  afterAll(async () => {
    if (!skip) await h.stop();
  });
  beforeEach((ctx) => {
    if (skip) ctx.skip(skip);
  });

  const ask = (who: 'ana' | 'ben', startDate: string, endDate: string, policyId = annual) =>
    h.services.leave.requests.create(h.as(who), { policyId, startDate, endDate });

  it('sends a request to the requester’s manager and books it once approved', async () => {
    const request = await ask('ana', '2026-11-09', '2026-11-13');
    expect(request).toMatchObject({ status: 'pending', days: 5, kind: 'annual' });
    const waiting = await h.approvals.list(h.actor('manager'), { scope: 'waiting' });
    const approval = waiting.items.find((item) => item.subject.id === request.id);
    expect(approval).toBeDefined();
    await h.approvals.decide(h.actor('manager'), approval!.id, { decision: 'approve' });
    const [after] = await h.services.leave.requests.list(h.as('ana'), { scope: 'mine' });
    expect(after).toMatchObject({ id: request.id, status: 'approved' });
    const balances = await h.services.leave.balances.list(h.as('ana'), {});
    expect(balances.find((b) => b.kind === 'annual')).toMatchObject({ booked: 5, left: 5 });
  });

  it('refuses overlapping days and more than the balance holds', async () => {
    await expect(ask('ana', '2026-11-12', '2026-11-16')).rejects.toThrow(ConflictError);
    await expect(ask('ana', '2026-11-16', '2026-11-27')).rejects.toThrow(ValidationError);
    await expect(ask('ana', '2026-11-14', '2026-11-15')).rejects.toThrow(/weekends/);
  });

  it('books leave that needs no approval at once and lets the requester withdraw', async () => {
    const sick = (await h.services.leave.policies.list()).find((p) => p.kind === 'sick')!;
    const request = await ask('ben', '2026-11-05', '2026-11-05', sick.id);
    expect(request).toMatchObject({ status: 'approved', approvalRequestId: null });
    const pending = await ask('ben', '2026-11-23', '2026-11-24');
    await expect(h.services.leave.requests.withdraw(h.as('ana'), pending.id)).rejects.toThrow(
      ForbiddenError,
    );
    const withdrawn = await h.services.leave.requests.withdraw(h.as('ben'), pending.id);
    expect(withdrawn.status).toBe('withdrawn');
    const approval = await h.approvals.get(h.actor('ben'), pending.approvalRequestId!);
    expect(approval.status).toBe('withdrawn');
  });

  it('shows everyone who is away but only the reporting line why', async () => {
    const window = { from: '2026-11-01', to: '2026-11-30' };
    const asColleague = await h.services.leave.absences.list(h.as('ben'), window);
    const anas = asColleague.filter((a) => a.userId === h.ids.ana);
    expect(anas.length).toBeGreaterThan(0);
    expect(anas.every((a) => a.kind === null)).toBe(true);
    const asManager = await h.services.leave.absences.list(h.as('manager'), window);
    expect(asManager.find((a) => a.userId === h.ids.ana)?.kind).toBe('annual');
    await expect(
      h.services.leave.balances.list(h.as('ben'), { userId: h.ids.ana }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('takes only one of two overlapping requests sent together', async () => {
    const results = await Promise.allSettled([
      ask('ben', '2026-12-07', '2026-12-08'),
      ask('ben', '2026-12-08', '2026-12-09'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [rejected] = results.filter((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });

  it('uses the location’s own policy over the general one of the same kind', async () => {
    const people = await h.kernel.directory.get(h.ids.ben);
    const local = await h.services.leave.policies.create(h.as('admin'), {
      name: 'Berlin annual leave',
      kind: 'annual',
      locationId: people!.locationId,
      allowanceDays: 28,
    });
    await expect(ask('ben', '2027-01-11', '2027-01-11')).rejects.toThrow(/for your location/);
    const request = await ask('ben', '2027-01-11', '2027-01-11', local.id);
    expect(request.policyId).toBe(local.id);
  });

  it('removes a request the engine cannot route, such as one with no manager', async () => {
    await expect(ask('manager' as never, '2026-12-01', '2026-12-01')).rejects.toThrow(
      ValidationError,
    );
    const [count] = await h.sql<{ n: number }[]>`
      select count(*)::int as n from leave_requests where user_id = ${h.ids.manager}`;
    expect(count?.n).toBe(0);
  });
});
