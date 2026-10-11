import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createFirstAdmin, startHarness, type Harness } from './harness.ts';

const SCIM_JSON = 'application/scim+json';

function scim(app: FastifyInstance, token: string | null) {
  return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) =>
    app.inject({
      method,
      url: `/scim/v2${url}`,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': SCIM_JSON }),
      },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });
}

describe('SCIM 2.0 provisioning against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  async function tokenFor(app: FastifyInstance) {
    const admin = await createFirstAdmin(app);
    const created = await call(app, 'POST', '/admin/scim-tokens', {
      cookie: admin.cookie,
      body: { name: 'Directory sync' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    return {
      admin,
      token: created.json().token as string,
      id: created.json().scimToken.id as string,
    };
  }

  it('creates, finds, updates and deactivates a person, with audit rows', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const { admin, token } = await tokenFor(app);
    const request = scim(app, token);

    const created = await request('POST', '/Users', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'Linus@Acme.dev',
      externalId: 'ext-linus',
      name: { givenName: 'Linus', familyName: 'T.' },
      emails: [{ value: 'linus@acme.dev', primary: true }],
      active: true,
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.headers['content-type']).toContain(SCIM_JSON);
    const user = created.json();
    expect(user).toMatchObject({
      userName: 'linus@acme.dev',
      externalId: 'ext-linus',
      active: true,
    });
    expect(created.headers.location).toBe(`http://localhost:8080/scim/v2/Users/${user.id}`);

    const found = await request(
      'GET',
      `/Users?filter=${encodeURIComponent('userName eq "linus@acme.dev"')}`,
    );
    expect(found.json()).toMatchObject({ totalResults: 1, Resources: [{ id: user.id }] });
    const byExternal = await request(
      'GET',
      `/Users?filter=${encodeURIComponent('externalId eq "ext-linus"')}`,
    );
    expect(byExternal.json().totalResults).toBe(1);

    const duplicate = await request('POST', '/Users', { userName: 'linus@acme.dev' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ status: '409', scimType: 'uniqueness' });

    const renamed = await request('PATCH', `/Users/${user.id}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'displayName', value: 'Linus Torvalds' }],
    });
    expect(renamed.json().displayName).toBe('Linus Torvalds');

    const deactivated = await request('PATCH', `/Users/${user.id}`, {
      Operations: [{ op: 'replace', value: { active: 'False' } }],
    });
    expect(deactivated.json().active).toBe(false);
    const people = await call(app, 'GET', `/users/${user.id}`, { cookie: admin.cookie });
    expect(people.json().status).toBe('deactivated');

    const reactivated = await request('PUT', `/Users/${user.id}`, {
      userName: 'linus@acme.dev',
      active: true,
    });
    expect(reactivated.json().active).toBe(true);
    expect((await request('DELETE', `/Users/${user.id}`)).statusCode).toBe(204);
    expect((await request('GET', `/Users/${user.id}`)).json().active).toBe(false);

    const audit =
      await sql`SELECT action, actor_kind FROM audit_log WHERE target_id = ${user.id} ORDER BY id`;
    expect(audit.map((row) => row['action'])).toEqual([
      'user.provisioned',
      'user.updated',
      'user.deactivated',
      'user.reactivated',
      'user.deactivated',
    ]);
    expect(new Set(audit.map((row) => row['actor_kind']))).toEqual(new Set(['system']));
  });

  it('turns groups into teams and keeps their members in step', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const { admin, token } = await tokenFor(app);
    const request = scim(app, token);
    const ada = (await request('POST', '/Users', { userName: 'ada@acme.dev' })).json();
    const bob = (await request('POST', '/Users', { userName: 'bob@acme.dev' })).json();

    const group = await request('POST', '/Groups', {
      displayName: 'Platform',
      externalId: 'grp-1',
      members: [{ value: ada.id }],
    });
    expect(group.statusCode, group.body).toBe(201);
    const teamId = group.json().id as string;
    const team = await call(app, 'GET', `/teams/${teamId}`, { cookie: admin.cookie });
    expect(team.json()).toMatchObject({ name: 'Platform' });
    const members = async () =>
      (await call(app, 'GET', `/teams/${teamId}/members`, { cookie: admin.cookie })).json().items;
    expect(await members()).toMatchObject([{ userId: ada.id }]);

    await request('PATCH', `/Groups/${teamId}`, {
      Operations: [{ op: 'add', path: 'members', value: [{ value: bob.id }] }],
    });
    await request('PATCH', `/Groups/${teamId}`, {
      Operations: [{ op: 'remove', path: `members[value eq "${ada.id}"]` }],
    });
    const after = (await request('GET', `/Groups/${teamId}`)).json();
    expect(after.members.map((member: { value: string }) => member.value)).toEqual([bob.id]);
    expect((await request('GET', `/Users/${bob.id}`)).json().groups).toEqual([
      { value: teamId, display: 'Platform' },
    ]);

    const unknown = await request('PATCH', `/Groups/${teamId}`, {
      Operations: [
        { op: 'add', path: 'members', value: [{ value: '0190f0f0-0000-7000-8000-000000000000' }] },
      ],
    });
    expect(unknown.statusCode).toBe(400);

    expect((await request('DELETE', `/Groups/${teamId}`)).statusCode).toBe(204);
    expect(await members()).toEqual([]);
    const audit = await sql`SELECT action FROM audit_log WHERE target_id = ${teamId} ORDER BY id`;
    expect(audit.map((row) => row['action'])).toEqual([
      'team.created',
      'team.member_added',
      'team.member_added',
      'team.member_removed',
      'team.member_removed',
    ]);
  });

  it('refuses missing, wrong and revoked tokens, unsupported filters and the last org admin', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { admin, token, id } = await tokenFor(app);
    const missing = await scim(app, null)('GET', '/Users');
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
    });
    expect((await scim(app, 'bmscim_not-a-real-token-at-all')('GET', '/Users')).statusCode).toBe(
      401,
    );
    expect((await scim(app, `${token}x`)('GET', '/Users')).statusCode).toBe(401);
    const filter = await scim(app, token)(
      'GET',
      `/Users?filter=${encodeURIComponent('title sw "x"')}`,
    );
    expect(filter.json()).toMatchObject({ status: '400', scimType: 'invalidFilter' });
    const last = await scim(app, token)('DELETE', `/Users/${admin.userId}`);
    expect(last.statusCode).toBe(409);
    expect((await scim(app, token)('GET', '/Users/not-a-uuid')).statusCode).toBe(404);

    expect(
      (await call(app, 'DELETE', `/admin/scim-tokens/${id}`, { cookie: admin.cookie })).statusCode,
    ).toBe(204);
    expect((await scim(app, token)('GET', '/Users')).statusCode).toBe(401);
    const listed = await call(app, 'GET', '/admin/scim-tokens', { cookie: admin.cookie });
    expect(listed.json()).toEqual({ items: [], baseUrl: 'http://localhost:8080/scim/v2' });
  });
});
