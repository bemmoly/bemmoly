import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('pages service', () => {
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

  it('creates pages in order with paths, breadcrumbs and word counts', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('ENG');
    const member = as(users.member);
    const root = await services.pages.create(member, { spaceId: space.id, title: 'Platform' });
    const second = await services.pages.create(member, { spaceId: space.id, title: 'Runbooks' });
    expect(root.position < second.position).toBe(true);
    const child = await services.pages.create(member, {
      spaceId: space.id,
      parentId: root.id,
      title: 'Auth migration',
      snapshot: doc('Move sessions to Postgres'),
    });
    expect(child).toMatchObject({
      depth: 1,
      parentId: root.id,
      wordCount: 4,
      status: 'draft',
      ownerId: users.member,
      breadcrumbs: [{ id: root.id, title: 'Platform' }],
      owner: { id: users.member, name: 'mo' },
    });
    const first = await services.pages.create(member, {
      spaceId: space.id,
      title: 'Overview',
      beforeId: root.id,
    });
    expect(first.position < root.position).toBe(true);
    expect((await services.pages.get(member, root.id)).hasChildren).toBe(true);
    expect(harness.realtime.at(-1)).toMatchObject({ kind: 'docs.tree', spaceId: space.id });
  });

  it('starts a page from a template snapshot', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('TPL');
    const [rfc] = await sql<{ id: string }[]>`select id from templates where key = 'rfc'`;
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'RFC: sessions',
      templateId: rfc!.id,
    });
    expect(page.templateId).toBe(rfc!.id);
    expect(page.snapshot?.type).toBe('doc');
    expect(page.wordCount).toBeGreaterThan(50);
  });

  it('refuses edits from viewers and outsiders and stale versions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('SEC');
    const page = await services.pages.create(as(users.member), { spaceId: space.id });
    await expect(
      services.pages.create(as(users.viewer), { spaceId: space.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await services.pages.get(as(users.viewer), page.id)).id).toBe(page.id);
    await expect(services.pages.get(as(users.outsider), page.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      services.pages.update(as(users.viewer), page.id, { title: 'No' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const renamed = await services.pages.update(as(users.member), page.id, {
      title: 'Threat model',
      version: page.version,
    });
    expect(renamed).toMatchObject({ title: 'Threat model', version: page.version + 1 });
    await expect(
      services.pages.update(as(users.member), page.id, { title: 'Stale', version: page.version }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('soft deletes a subtree and restores exactly what went with it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('OPS');
    const member = as(users.member);
    const parent = await services.pages.create(member, { spaceId: space.id, title: 'Parent' });
    const child = await services.pages.create(member, {
      spaceId: space.id,
      parentId: parent.id,
      title: 'Child',
    });
    const loose = await services.pages.create(member, {
      spaceId: space.id,
      parentId: parent.id,
      title: 'Deleted first',
    });
    await services.pages.remove(member, loose.id);
    await services.pages.remove(member, parent.id);
    await expect(services.pages.get(member, child.id)).rejects.toBeInstanceOf(NotFoundError);
    const trash = await services.pages.listTrash(member, space.key, { limit: 50 });
    expect(trash.items.map((page) => page.title)).toEqual(['Parent', 'Deleted first']);
    const restored = await services.pages.restore(member, parent.id);
    expect(restored.deletedAt).toBeNull();
    expect((await services.pages.get(member, child.id)).deletedAt).toBeNull();
    await expect(services.pages.get(member, loose.id)).rejects.toBeInstanceOf(NotFoundError);
    const orphan = await services.pages.restore(member, loose.id);
    expect(orphan).toMatchObject({ parentId: parent.id, depth: 1 });
    await expect(services.pages.remove(as(users.viewer), parent.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining(['page.created', 'page.deleted', 'page.restored']),
    );
  });

  it('brings a page back at the root when its parent is still in the trash', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('ORF');
    const member = as(users.member);
    const parent = await services.pages.create(member, { spaceId: space.id, title: 'Parent' });
    const child = await services.pages.create(member, {
      spaceId: space.id,
      parentId: parent.id,
      title: 'Child',
    });
    await services.pages.remove(member, child.id);
    await services.pages.remove(member, parent.id);
    const back = await services.pages.restore(member, child.id);
    expect(back).toMatchObject({ parentId: null, depth: 0, breadcrumbs: [] });
  });
});
