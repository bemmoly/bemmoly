import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accessDecisionSchema,
  bindingsResponseSchema,
  forbiddenDetailsSchema,
  policySchema,
} from '../../../../shared/access.ts';
import { seedCatalogFixture, type CatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

const TIER0_POLICY = {
  key: 'tier-0-to-prod',
  name: 'Tier 0 to Prod',
  scope: { kind: 'organisation' },
  applies: 'application.tier == 0 && env.class == "prod"',
  requirements: {
    requester: 'has_role("maintainer")',
    approvals: [{ from: 'owning_team', count: 2, exclude: ['authors'] }],
    gates: ['tests', 'canary'],
    denyIf: 'freeze.active',
  },
};

describe('access endpoints and the engine', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let fixture: CatalogFixture;
  let secondAdmin = '';
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    fixture = await seedCatalogFixture(harness.sql, harness.users.member);
    const [row] = await harness.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'grace@example.test', 'Grace Admin', id from roles where key = 'org_admin'
      returning id`;
    secondAdmin = row?.id ?? '';
    await harness.sql`
      insert into module_grants (module_id, subject_kind, subject_id)
      values ('pipelines', 'user', ${secondAdmin})`;
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const users = () => harness?.users ?? { admin: '', member: '', outsider: '' };
  const check = (as: string, body: object) => http.send('POST', '/access/checks', as, body);

  it('makes the owning team Maintainer and lets it request Prod', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await check(users().member, {
      action: 'request_prod',
      application: 'checkout-api',
      environment: 'prod-asia-south1',
    });
    expect(response.statusCode).toBe(200);
    const decision = accessDecisionSchema.parse(response.json());
    expect(decision.allowed).toBe(true);
    expect(decision.trace).toContainEqual(
      expect.objectContaining({
        kind: 'ownership',
        text: 'Payments owns checkout-api: Maintainer',
      }),
    );
  });

  it('holds a Tier 0 policy change until a second Platform admin approves it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const created = await http.send('POST', '/policies', users().admin, TIER0_POLICY);
    expect(created.statusCode).toBe(201);
    const policy = policySchema.parse(created.json());
    expect(policy.pending).toMatchObject({ version: 1 });
    expect(policy.enabled).toBe(false);
    expect(policy.sentence).toContain('Only a Maintainer can request it.');

    const own = await http.send(
      'POST',
      `/policies/${policy.id}/versions/1/approvals`,
      users().admin,
    );
    expect(own.statusCode).toBe(403);
    const approved = await http.send(
      'POST',
      `/policies/${policy.id}/versions/1/approvals`,
      secondAdmin,
    );
    expect(approved.statusCode).toBe(201);
    expect(policySchema.parse(approved.json())).toMatchObject({
      enabled: true,
      version: 1,
      pending: null,
    });

    const off = await http.send('PATCH', `/policies/${policy.id}`, users().admin, {
      enabled: false,
    });
    expect(off.statusCode).toBe(400);
    const versions = await http.get(`/policies/${policy.id}/versions`, users().member);
    expect(versions.json().items[0]).toMatchObject({ approvedBy: { name: 'Grace Admin' } });
  });

  it('refuses a policy whose CEL does not type-check, naming the field', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/policies', users().admin, {
      ...TIER0_POLICY,
      key: 'broken',
      applies: 'application.tierx == 0',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toMatch(/^applies: .*tierx/);
  });

  it('binds a team at a group and shows it inherited on the application', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [group] = await harness.sql<{ id: string }[]>`
      select id from pipeline_groups where key = 'checkout'`;
    const created = await http.send('POST', '/bindings', users().admin, {
      subject: { kind: 'team', id: fixture.teams.search },
      role: 'developer',
      scope: { kind: 'group', id: group?.id },
    });
    expect(created.statusCode).toBe(201);
    const duplicate = await http.send('POST', '/bindings', users().admin, {
      subject: { kind: 'team', id: fixture.teams.search },
      role: 'developer',
      scope: { kind: 'group', id: group?.id },
    });
    expect(duplicate.statusCode).toBe(409);
    const listed = bindingsResponseSchema.parse(
      (await http.get('/bindings', users().member, { application: 'checkout-api' })).json(),
    );
    expect(listed.items[0]).toMatchObject({ implicit: true, role: 'maintainer' });
    expect(listed.items).toContainEqual(
      expect.objectContaining({
        role: 'developer',
        inherited: true,
        inheritedFrom: expect.objectContaining({
          name: 'Checkout',
          path: [expect.any(String), 'Commerce', 'Checkout'],
        }),
      }),
    );
    const refused = await http.send('POST', '/bindings', users().member, {
      subject: { kind: 'team', id: fixture.teams.search },
      role: 'viewer',
      scope: { kind: 'organisation' },
    });
    expect(refused.statusCode).toBe(403);
    expect(forbiddenDetailsSchema.parse(refused.json().details).sentence).toContain(
      'needs a Platform admin',
    );
  });

  it('throws an explained refusal and records the decision', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const memberCtx = harness.as(users().member);
    const error = await harness.services.access
      .authorizeAction(memberCtx, 'deploy', {
        application: 'checkout-api',
        environment: 'prod-asia-south1',
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ForbiddenError);
    const details = forbiddenDetailsSchema.parse((error as ForbiddenError).details);
    expect(details.sentence).toContain('needs a Release manager');
    const [stored] = await harness.sql<{ allowed: boolean; action: string }[]>`
      select allowed, action from pipeline_decisions where user_id = ${users().member}
      order by created_at desc limit 1`;
    expect(stored).toEqual({ allowed: false, action: 'deploy' });
  });

  it('sees a new team membership at once, through the version stamp', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const target = { application: 'pricing-svc', environment: 'staging' };
    const memberCtx = harness.as(users().member);
    const before = await harness.services.access.decideFor(
      memberCtx,
      users().member,
      'run',
      target,
    );
    expect(before.allowed).toBe(false);
    await harness.sql`
      insert into team_members (team_id, user_id) values (${fixture.teams.search}, ${users().member})`;
    const after = await harness.services.access.decideFor(memberCtx, users().member, 'run', target);
    expect(after.allowed).toBe(true);
  });

  it('keeps people outside Pipelines out before any scope is read', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await check(users().outsider, { action: 'view' });
    expect(response.statusCode).toBe(403);
  });
});
