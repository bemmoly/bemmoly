import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

describe('spaces service', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('creates a space, makes the creator its admin and audits it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await services.spaces.create(as(users.admin), {
      key: 'eng',
      name: 'Engineering',
    });
    expect(space).toMatchObject({ key: 'ENG', name: 'Engineering', pageCount: 0 });
    const [member] = await sql<{ key: string }[]>`
      select r.key from space_members m join roles r on r.id = m.role_id
      where m.space_id = ${space.id} and m.user_id = ${users.admin}`;
    expect(member?.key).toBe('project_admin');
    expect(await harness.auditActions()).toContain('space.created');
    expect(harness.realtime.at(-1)).toMatchObject({ kind: 'docs.space', spaceId: space.id });
    await expect(
      services.spaces.create(as(users.admin), { key: 'ENG', name: 'Again' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('lists only the spaces a person belongs to; admins see every one', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const mine = await harness.space('OPS');
    await services.spaces.create(as(users.admin), { key: 'HR', name: 'People' });
    const forMember = await services.spaces.list(as(users.member), { limit: 50, archived: false });
    expect(forMember.items.map((space) => space.key)).toEqual(['OPS']);
    const forAdmin = await services.spaces.list(as(users.admin), { limit: 50, archived: false });
    expect(forAdmin.items.map((space) => space.key)).toEqual(expect.arrayContaining(['OPS', 'HR']));
    expect((await services.spaces.get(as(users.member), 'ops')).id).toBe(mine.id);
  });

  it('refuses people without the capability or the membership', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('SEC');
    await expect(
      services.spaces.create(as(users.member), { key: 'NOPE', name: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(services.spaces.get(as(users.outsider), space.key)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      services.spaces.update(as(users.member), space.key, { name: 'Renamed' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(services.spaces.get(as(users.admin), 'MISSING')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('updates, archives, then deletes only an archived space', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('TMP');
    const admin = as(users.admin);
    const renamed = await services.spaces.update(admin, space.key, {
      name: 'Temporary',
      aiExcluded: true,
    });
    expect(renamed).toMatchObject({ name: 'Temporary', aiExcluded: true, archivedAt: null });
    await expect(services.spaces.remove(admin, space.key)).rejects.toBeInstanceOf(ConflictError);
    const archived = await services.spaces.update(admin, space.key, { archived: true });
    expect(archived.archivedAt).not.toBeNull();
    await services.spaces.remove(admin, space.key);
    await expect(services.spaces.get(admin, space.key)).rejects.toBeInstanceOf(NotFoundError);
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining(['space.updated', 'space.deleted']),
    );
  });
});
