import { createModuleAccessWriter, createRequestAuthorization } from '@bemmoly/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addPerson,
  call,
  createFirstAdmin,
  roleId,
  startHarness,
  type Harness,
} from './harness.ts';

type Cell = { allowed: boolean; lockedByOrg: boolean };
type MatrixItem = { name: string; cells: Record<string, Cell> };

describe('capability matrix, org locks and module grants against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  const cell = (items: MatrixItem[], capability: string, role: string) =>
    items.find((item) => item.name === capability)?.cells[role];

  it('serves the matrix with the mock defaults and lets org admins edit and lock it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const member = await addPerson(harness, admin, { email: 'aisha@acmelabs.dev', role: 'member' });
    expect((await call(app, 'GET', '/capabilities', { cookie: member.cookie })).statusCode).toBe(
      403,
    );

    const matrix = (await call(app, 'GET', '/capabilities', { cookie: admin })).json();
    expect(matrix.roles.map((role: { key: string }) => role.key)).toEqual([
      'org_admin',
      'project_admin',
      'member',
      'viewer',
      'contractor',
    ]);
    const memberRole = await roleId(app, admin, 'member');
    expect(cell(matrix.items, 'workspace.billing.manage', memberRole)).toEqual({
      allowed: false,
      lockedByOrg: true,
    });
    expect(cell(matrix.items, 'sample.view', memberRole)?.allowed).toBe(true);

    const put = await call(app, 'PUT', `/roles/${memberRole}/capabilities`, {
      cookie: admin,
      body: { items: [{ capability: 'ai.actions.run', allowed: false, lockedByOrg: true }] },
    });
    expect(put.statusCode).toBe(200);
    const edited = put
      .json()
      .items.find((item: { capability: string }) => item.capability === 'ai.actions.run');
    expect(edited).toMatchObject({ allowed: false, lockedByOrg: true });

    const orgAdmin = await roleId(app, admin, 'org_admin');
    const fixed = await call(app, 'PUT', `/roles/${orgAdmin}/capabilities`, {
      cookie: admin,
      body: { items: [{ capability: 'ai.assist.use', allowed: false }] },
    });
    expect(fixed.statusCode).toBe(400);
    const unknown = await call(app, 'PUT', `/roles/${memberRole}/capabilities`, {
      cookie: admin,
      body: { items: [{ capability: 'work.issue.fly', allowed: true }] },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('lets a delegated role manager edit unlocked rows only', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const custom = await call(app, 'POST', '/roles', {
      cookie: admin,
      body: { name: 'People manager', copyFromRoleId: await roleId(app, admin, 'member') },
    });
    expect(custom.statusCode).toBe(201);
    expect(custom.json()).toMatchObject({ key: 'people_manager', isSystem: false });
    const grant = await call(app, 'PUT', `/roles/${custom.json().id}/capabilities`, {
      cookie: admin,
      body: { items: [{ capability: 'workspace.roles.manage', allowed: true }] },
    });
    expect(grant.statusCode).toBe(200);
    const manager = await addPerson(harness, admin, {
      email: 'priya@acmelabs.dev',
      role: 'people_manager',
    });
    const viewer = await roleId(app, admin, 'viewer');
    const locked = await call(app, 'PUT', `/roles/${viewer}/capabilities`, {
      cookie: manager.cookie,
      body: { items: [{ capability: 'workspace.billing.manage', allowed: true }] },
    });
    expect(locked.statusCode).toBe(403);
    const lock = await call(app, 'PUT', `/roles/${viewer}/capabilities`, {
      cookie: manager.cookie,
      body: { items: [{ capability: 'ai.assist.use', allowed: true, lockedByOrg: true }] },
    });
    expect(lock.statusCode).toBe(403);
    const open = await call(app, 'PUT', `/roles/${viewer}/capabilities`, {
      cookie: manager.cookie,
      body: { items: [{ capability: 'ai.actions.run', allowed: true }] },
    });
    expect(open.statusCode).toBe(200);
  });

  it('resolves module access from everyone, team, role and person grants', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, identity } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const team = (
      await call(app, 'POST', '/teams', { cookie: admin, body: { name: 'Platform' } })
    ).json();
    const onTeam = await addPerson(harness, admin, {
      email: 'a@acmelabs.dev',
      role: 'member',
      teamId: team.id,
    });
    const offTeam = await addPerson(harness, admin, { email: 'b@acmelabs.dev', role: 'viewer' });
    const modulesOf = async (cookie: string) =>
      (await call(app, 'GET', '/me', { cookie })).json().modules as string[];

    expect(await modulesOf(admin)).toEqual(['sample']);
    expect(await modulesOf(onTeam.cookie)).toEqual([]);

    const writer = createModuleAccessWriter(identity.db);
    const system = { kind: 'system', id: 'modules' } as const;
    await writer.apply('sample', { mode: 'none' }, system);
    expect(await modulesOf(offTeam.cookie)).toEqual([]);
    await writer.apply('sample', { mode: 'everyone' }, system);
    await writer.apply('sample', { mode: 'everyone' }, system);
    const grants = (
      await call(app, 'GET', '/module-grants?moduleId=sample', { cookie: admin })
    ).json().items;
    expect(grants).toHaveLength(1);
    expect(await modulesOf(offTeam.cookie)).toEqual(['sample']);

    await call(app, 'DELETE', `/module-grants/${grants[0].id}`, { cookie: admin });
    const byTeam = await call(app, 'POST', '/module-grants', {
      cookie: admin,
      body: { moduleId: 'sample', subjectKind: 'team', subjectId: team.id },
    });
    expect(byTeam.statusCode).toBe(201);
    expect(await modulesOf(onTeam.cookie)).toEqual(['sample']);
    expect(await modulesOf(offTeam.cookie)).toEqual([]);

    await call(app, 'POST', '/module-grants', {
      cookie: admin,
      body: {
        moduleId: 'sample',
        subjectKind: 'role',
        subjectId: await roleId(app, admin, 'viewer'),
      },
    });
    expect(await modulesOf(offTeam.cookie)).toEqual(['sample']);

    const disabled = await call(app, 'POST', '/module-grants', {
      cookie: admin,
      body: { moduleId: 'work', subjectKind: 'everyone' },
    });
    expect(disabled.statusCode).toBe(404);
    expect(disabled.json().code).toBe('module_not_enabled');
  });

  it('checks module access, then membership, then capability, with distinct codes', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, identity, sql, modules } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const member = await addPerson(harness, admin, { email: 'm@acmelabs.dev', role: 'member' });
    const contractor = await addPerson(harness, admin, {
      email: 'c@contractor.io',
      role: 'contractor',
    });
    const authz = () => createRequestAuthorization({ db: identity.db, modules });
    const as = (userId: string) => ({ kind: 'user' as const, id: userId });

    await expect(
      authz().authorize(as(member.userId), 'sample.view', { kind: 'module' }),
    ).rejects.toMatchObject({
      code: 'module_access_denied',
    });
    await call(app, 'POST', '/module-grants', {
      cookie: admin,
      body: { moduleId: 'sample', subjectKind: 'everyone' },
    });
    await expect(
      authz().authorize(as(member.userId), 'sample.view', { kind: 'module' }),
    ).resolves.toBeUndefined();
    await expect(
      authz().authorize(as(contractor.userId), 'sample.view', { kind: 'module' }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      authz().authorize(as(member.userId), 'work.issue.view', { kind: 'module' }),
    ).rejects.toMatchObject({
      code: 'module_not_enabled',
    });

    const project = '01900000-0000-7000-8000-000000000001';
    const memberRole = await roleId(app, admin, 'member');
    const onProject = { kind: 'project', id: project } as const;
    await expect(
      authz().authorize(as(member.userId), 'ai.assist.use', onProject),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    await sql`insert into project_members (project_id, user_id, role_id) values (${project}, ${member.userId}, ${memberRole})`;
    await expect(
      authz().authorize(as(member.userId), 'ai.assist.use', onProject),
    ).resolves.toBeUndefined();
    await sql`insert into project_role_capabilities (project_id, role_id, capability, allowed)
      values (${project}, ${memberRole}, 'ai.assist.use', false)`;
    expect(await authz().can(as(member.userId), 'ai.assist.use', onProject)).toBe(false);
    expect(await authz().can(as(member.userId), 'ai.assist.use', { kind: 'workspace' })).toBe(true);

    await call(app, 'PUT', `/roles/${memberRole}/capabilities`, {
      cookie: admin,
      body: { items: [{ capability: 'ai.assist.use', allowed: true, lockedByOrg: true }] },
    });
    expect(await authz().can(as(member.userId), 'ai.assist.use', onProject)).toBe(true);
  });
});
