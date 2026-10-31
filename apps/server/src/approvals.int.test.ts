import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * The approval engine through the real host: the routes are mounted, definitions version on
 * every save, and the caller's lists and delegation answer. Requests themselves are started
 * in process by modules, so the engine's own tests cover the run time.
 */
describe('approvals in the host', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;

  const call = async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: response.body ? response.json() : null };
  };

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('versions workflow definitions and answers the caller’s lists', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const definition = {
      moduleId: 'expenses',
      key: 'expenses.claim',
      name: 'Expense claims',
      spec: { stages: [{ name: 'Admins', approvers: [{ type: 'role', roleKey: 'org_admin' }] }] },
    };
    const first = await call('POST', '/admin/approval-workflows', definition);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ version: 1, spec: { autoApprove: [] } });
    const second = await call('POST', '/admin/approval-workflows', {
      ...definition,
      name: 'Claims',
    });
    expect(second.body).toMatchObject({ id: first.body.id, version: 2, name: 'Claims' });
    const listed = await call('GET', '/admin/approval-workflows?moduleId=expenses');
    expect(listed.body.items).toHaveLength(1);
    const bad = await call('POST', '/admin/approval-workflows', {
      ...definition,
      spec: { stages: [] },
    });
    expect(bad.status).toBe(400);

    expect((await call('GET', '/approval-requests')).body).toEqual({ items: [], nextCursor: null });
    const missing = await call('GET', '/approval-requests/018f0000-0000-7000-8000-000000000001');
    expect(missing.status).toBe(404);

    expect((await call('GET', '/approval-delegations/me')).body).toEqual({ delegation: null });
    expect((await call('DELETE', '/approval-delegations/me')).status).toBe(204);
  });
});
