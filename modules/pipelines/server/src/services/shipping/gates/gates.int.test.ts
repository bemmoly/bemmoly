import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPipelinesHarness, type PipelinesHarness } from '../../../testing/harness.ts';
import { seedShippingFixture, type ShippingFixture } from '../../../testing/shipping-fixture.ts';
import { loadApplication, loadEnvironment, loadRelease } from '../load.ts';
import type { GateFacts } from './contract.ts';
import { createWebhookCaller, evaluateGates } from './index.ts';
import { signWebhook } from '../../../clients/webhook-gate.ts';

/* Gates against real rows: required CI checks, freezes and their override, a webhook gate. */

describe('gates', () => {
  let harness: PipelinesHarness | undefined;
  let f: ShippingFixture;
  let reason = '';
  let facts: GateFacts;

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
    const sql = harness.sql;
    const repo = await sql<{ id: string }[]>`insert into pipeline_repositories (full_name, url)
      values ('acme/checkout', 'https://github.com/acme/checkout') returning id`;
    await sql`update pipeline_applications set repository_id = ${repo[0]?.id ?? ''} where id = ${f.app}`;
    const release = await f.release('v1.0.0');
    facts = {
      now: new Date(),
      promotion: {
        id: '00000000-0000-0000-0000-000000000000',
        requestedBy: null,
        releaseDigest: 'sha256:x',
        freezeOverride: null,
      },
      release: await loadRelease(sql, release),
      application: await loadApplication(sql, { id: f.app }),
      environment: await loadEnvironment(sql, f.environments.prodAsia),
      requirements: { approvals: [], gates: [], window: null, policies: [] },
    };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const deps = (send?: typeof fetch) => ({
    sql: harness?.sql as never,
    metrics: null,
    webhook: createWebhookCaller(async () => 'shh', send),
  });

  it('waits for a required check that has not reported, and fails on a failed one', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [waiting] = await evaluateGates(['external_check("security.yml")'], facts, deps());
    expect(waiting).toMatchObject({
      state: 'pending',
      reason: 'Waiting for security.yml',
      key: 'external_check:security.yml',
    });
    await harness.sql`
      insert into pipeline_external_checks
        (repository_full_name, commit_sha, kind, name, status, conclusion, occurred_at)
      values ('acme/checkout', 'a1c9e3f', 'workflow_run', 'security.yml', 'completed', 'failure', now())`;
    const [failed] = await evaluateGates(['external_check("security.yml")'], facts, deps());
    expect(failed).toMatchObject({
      state: 'fail',
      reason: 'security.yml failed',
      label: 'Checks: security.yml',
    });
  });

  it('holds a promotion in a freeze until a Release manager overrides it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await harness.sql`
      insert into pipeline_freezes (name, environment_class, starts_at, ends_at)
      values ('Diwali freeze', 'prod', now() - interval '1 hour', now() + interval '2 days')`;
    const [frozen] = await evaluateGates(['freeze'], facts, deps());
    expect(frozen?.state).toBe('pending');
    expect(frozen?.reason).toMatch(/^Diwali freeze until/);
    const overridden = {
      ...facts,
      promotion: {
        ...facts.promotion,
        freezeOverride: { by: 'x', byName: 'Ada Admin', reason: 'Payment outage fix' },
      },
    };
    const [through] = await evaluateGates(['freeze'], overridden, deps());
    expect(through).toMatchObject({ state: 'pass' });
    expect(through?.reason).toMatch(/overridden by Ada Admin: Payment outage fix/);
  });

  it('asks a webhook gate, signed, and treats no answer as waiting', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await harness.sql`insert into pipeline_gate_webhooks (key, name, url, timeout_ms)
      values ('opa', 'OPA', 'https://opa.example.test/allow', 500)`;
    let signature = '';
    const allow: typeof fetch = async (_url, init) => {
      const headers = new Headers(init?.headers);
      signature = headers.get('x-bemmoly-signature') ?? '';
      const expected = signWebhook(
        'shh',
        headers.get('x-bemmoly-timestamp') ?? '',
        String(init?.body),
      );
      return new Response(
        JSON.stringify({ allow: signature === expected, reason: 'No critical CVEs' }),
      );
    };
    const [passed] = await evaluateGates(['webhook("opa")'], facts, deps(allow));
    expect(passed).toMatchObject({
      state: 'pass',
      reason: 'OPA: No critical CVEs',
      label: 'Check by opa',
    });
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    const deny: typeof fetch = async () =>
      new Response(JSON.stringify({ allow: false, reason: 'Unsigned image' }));
    const [denied] = await evaluateGates(['webhook("opa")'], facts, deps(deny));
    expect(denied).toMatchObject({ state: 'fail', reason: 'OPA: Unsigned image' });
    const down: typeof fetch = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    const [waiting] = await evaluateGates(['webhook("opa")'], facts, deps(down));
    expect(waiting?.state).toBe('pending');
    expect(waiting?.recheckAt).not.toBeNull();
  });
});
