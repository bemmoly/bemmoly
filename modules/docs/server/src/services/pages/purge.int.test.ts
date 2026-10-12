import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

describe('trash purge', () => {
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

  it('deletes a trashed subtree forever, for space admins only', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('PRG');
    const member = as(users.member);
    const parent = await services.pages.create(member, { spaceId: space.id, title: 'Old' });
    const child = await services.pages.create(member, {
      spaceId: space.id,
      parentId: parent.id,
      title: 'Older',
    });
    const live = await services.pages.create(member, { spaceId: space.id, title: 'Live' });
    await services.pages.remove(member, parent.id);
    const [row] = (await services.pages.listTrash(member, space.key, { limit: 50 })).items;
    expect(row).toMatchObject({ title: 'Old', wasIn: null, pagesInside: 1 });
    expect(row?.deletedBy?.id).toBe(users.member);
    await expect(services.pages.deleteForever(member, space.key, parent.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      services.pages.deleteForever(as(users.admin), space.key, live.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    await services.pages.deleteForever(as(users.admin), space.key, parent.id);
    const left = await sql<{ id: string }[]>`
      select id from pages where id = any(${[parent.id, child.id, live.id]}::uuid[])`;
    expect(left.map((row) => row.id)).toEqual([live.id]);
    expect(await harness.auditActions()).toEqual(expect.arrayContaining(['page.purged']));
  });

  it('empties a space’s trash and leaves other spaces alone', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('EMP');
    const other = await harness.space('OTH');
    const member = as(users.member);
    const admin = as(users.admin);
    for (const title of ['One', 'Two']) {
      const page = await services.pages.create(member, { spaceId: space.id, title });
      await services.pages.remove(member, page.id);
    }
    const kept = await services.pages.create(member, { spaceId: other.id, title: 'Kept' });
    await services.pages.remove(member, kept.id);
    expect(await services.pages.emptyTrash(admin, space.key)).toEqual({ deleted: 2 });
    expect((await services.pages.listTrash(admin, space.key, { limit: 50 })).items).toEqual([]);
    const otherTrash = await services.pages.listTrash(admin, other.key, { limit: 50 });
    expect(otherTrash.items.map((page) => page.title)).toEqual(['Kept']);
  });

  it('purges only pages past the retention', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('RET');
    const member = as(users.member);
    const stale = await services.pages.create(member, { spaceId: space.id, title: 'Stale' });
    const fresh = await services.pages.create(member, { spaceId: space.id, title: 'Fresh' });
    await services.pages.remove(member, stale.id);
    await services.pages.remove(member, fresh.id);
    await sql`update pages set deleted_at = now() - interval '31 days' where id = ${stale.id}`;
    expect(await services.pages.purgeExpiredTrash()).toBeGreaterThanOrEqual(1);
    const left = await sql<{ id: string }[]>`
      select id from pages where id = any(${[stale.id, fresh.id]}::uuid[])`;
    expect(left.map((row) => row.id)).toEqual([fresh.id]);
    expect(await services.pages.purgeExpiredTrash()).toBe(0);
  });

  it('removes the links, mentions and kernel rows of the pages it deletes', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('LNK');
    const member = as(users.member);
    const gone = await services.pages.create(member, { spaceId: space.id, title: 'Gone' });
    const kept = await services.pages.create(member, { spaceId: space.id, title: 'Kept' });
    await sql`
      insert into links (source_kind, source_id, target_kind, target_id, kind) values
        ('page', ${gone.id}, 'page', ${kept.id}, 'mention'),
        ('page', ${kept.id}, 'page', ${gone.id}, 'linked'),
        ('page', ${kept.id}, 'issue', uuidv7(), 'linked')`;
    await sql`
      insert into notifications (user_id, kind, target_kind, target_id, delivery)
      values (${users.member}, 'mention', 'page', ${gone.id}, 'inapp')`;
    await sql`
      insert into pending_embeddings (target_kind, target_id) values ('docs.page', ${gone.id})`;
    await services.pages.remove(member, gone.id);
    await services.pages.deleteForever(as(users.admin), space.key, gone.id);
    const [left] = await sql<{ links: number; kernel: number; orphans: number }[]>`
      select
        (select count(*)::int from links where source_id = ${kept.id} or target_id = ${kept.id})
          as links,
        ((select count(*) from notifications where target_id = ${gone.id}::text)
          + (select count(*) from pending_embeddings where target_id = ${gone.id}::text))::int
          as kernel,
        (select sum(orphans)::int from integrity_orphans_docs) as orphans`;
    expect(left).toEqual({ links: 1, kernel: 0, orphans: 0 });
  });
});
