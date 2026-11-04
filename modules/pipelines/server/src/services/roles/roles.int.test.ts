import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approvalGroupSchema,
  approvalGroupsResponseSchema,
  invitePeopleResponseSchema,
  peopleResponseSchema,
  pipelinesMeSchema,
} from '../../../../shared/roles.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

describe('roles, people and approval groups', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';
  let newcomer = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    // Someone in the workspace with Pipelines granted but no Pipelines role yet.
    const [row] = await harness.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'noor@example.test', 'Noor Approver', id from roles where key = 'member'
      returning id`;
    newcomer = row?.id ?? '';
    await harness.sql`
      insert into module_grants (module_id, subject_kind, subject_id)
      values ('pipelines', 'user', ${newcomer})`;
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const users = () => harness?.users ?? { admin: '', member: '', outsider: '' };
  const me = async (as: string) => pipelinesMeSchema.parse((await http.get('/me', as)).json());

  it('makes the installing admin a Platform admin and leaves others out until invited', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect(await me(users().admin)).toMatchObject({
      role: 'platform_admin',
      places: ['home', 'services', 'runs', 'changes', 'environments', 'platform'],
      readOnly: false,
    });
    expect(await me(newcomer)).toMatchObject({ role: null, places: [], readOnly: true });
    const refused = await http.get('/approval-groups', newcomer);
    expect(refused.statusCode).toBe(403);
  });

  it('keeps People and roles to Platform admins', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect((await http.get('/people', users().member)).statusCode).toBe(403);
    const people = peopleResponseSchema.parse((await http.get('/people', users().admin)).json());
    expect(people.items.map((p) => [p.user.name, p.role])).toEqual([
      ['Ada Admin', 'platform_admin'],
      ['Priya Sharma', 'developer'],
    ]);
  });

  it('gives an account its role at once and keeps a new address pending', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const created = await http.send('POST', '/approval-groups', users().admin, {
      name: 'Production approvers',
    });
    expect(created.statusCode).toBe(201);
    const group = approvalGroupSchema.parse(created.json());
    const response = await http.send('POST', '/people/invitations', users().admin, {
      emails: ['noor@example.test', 'new.person@example.test'],
      role: 'approver',
      groups: [group.id],
    });
    expect(response.statusCode).toBe(201);
    const invited = invitePeopleResponseSchema.parse(response.json());
    expect(invited.needAccount).toEqual(['new.person@example.test']);
    expect(invited.items).toEqual([
      expect.objectContaining({ email: 'noor@example.test', role: 'approver', pending: false }),
      expect.objectContaining({ email: 'new.person@example.test', pending: true }),
    ]);
    expect(await me(newcomer)).toMatchObject({ role: 'approver', places: ['home', 'changes'] });
    const groups = approvalGroupsResponseSchema.parse(
      (await http.get('/approval-groups', newcomer)).json(),
    );
    expect(groups.items[0]?.members.map((m) => m.user.name)).toEqual(['Noor Approver']);
  });

  it('claims a pending role when the invited person first opens Pipelines', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [row] = await harness.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'New.Person@example.test', 'New Person', id from roles where key = 'member'
      returning id`;
    const id = row?.id ?? '';
    await harness.sql`
      insert into module_grants (module_id, subject_kind, subject_id) values ('pipelines', 'user', ${id})`;
    expect(await me(id)).toMatchObject({ role: 'approver' });
    const [left] = await harness.sql<{ n: number }[]>`
      select count(*)::int as n from pipeline_person_invitations`;
    expect(left?.n).toBe(0);
    const groups = approvalGroupsResponseSchema.parse(
      (await http.get('/approval-groups', id)).json(),
    );
    expect(groups.items[0]?.members).toHaveLength(2);
  });

  it('lets an Approver approve but not run, and never changes your own role', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const approver = harness.as(newcomer);
    expect((await harness.services.access.decideFor(approver, newcomer, 'approve')).allowed).toBe(
      true,
    );
    expect((await harness.services.access.decideFor(approver, newcomer, 'run')).allowed).toBe(
      false,
    );
    const own = await http.send('PUT', `/people/${users().admin}`, users().admin, {
      role: 'viewer',
    });
    expect(own.statusCode).toBe(400);
    const changed = await http.send('PUT', `/people/${newcomer}`, users().admin, {
      role: 'viewer',
    });
    expect(changed.statusCode).toBe(200);
    expect(await me(newcomer)).toMatchObject({ role: 'viewer', readOnly: true });
  });

  it('refuses to delete a group an approval rule names', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const groups = approvalGroupsResponseSchema.parse(
      (await http.get('/approval-groups', users().admin)).json(),
    );
    const group = groups.items[0];
    await harness.sql`
      insert into pipeline_environments (key, name, position, approval_rule)
      values ('live', 'Live', 9,
        ${JSON.stringify({ steps: [{ group: group?.id, count: 1, when: 'always' }] })}::jsonb)`;
    const refused = await http.send('DELETE', `/approval-groups/${group?.id}`, users().admin);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain('approval rule of Live');
    const renamed = await http.send('PATCH', `/approval-groups/${group?.id}`, users().admin, {
      name: 'Live approvers',
    });
    expect(approvalGroupSchema.parse(renamed.json())).toMatchObject({
      name: 'Live approvers',
      usedBy: [{ key: 'live', name: 'Live' }],
    });
  });

  it('takes a person out of Pipelines and every group', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const removed = await http.send('DELETE', `/people/${newcomer}`, users().admin);
    expect(removed.statusCode).toBe(204);
    expect(await me(newcomer)).toMatchObject({ role: null });
    const [left] = await harness.sql<{ n: number }[]>`
      select count(*)::int as n from pipeline_approval_group_members where user_id = ${newcomer}`;
    expect(left?.n).toBe(0);
  });
});
