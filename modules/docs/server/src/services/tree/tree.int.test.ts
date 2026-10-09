import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

describe('tree, move and status services', () => {
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

  it('pages through the children of a parent in sibling order', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('TREE');
    const member = as(users.member);
    const titles = ['A', 'B', 'C', 'D', 'E'];
    for (const title of titles) await services.pages.create(member, { spaceId: space.id, title });
    const first = await services.tree.children(member, space.key, { limit: 2 });
    expect(first.items.map((page) => page.title)).toEqual(['A', 'B']);
    const second = await services.tree.children(member, space.key, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((page) => page.title)).toEqual(['C', 'D']);
    const third = await services.tree.children(member, space.key, {
      limit: 2,
      cursor: second.nextCursor ?? undefined,
    });
    expect(third).toMatchObject({ items: [{ title: 'E' }], nextCursor: null });
    await expect(
      services.tree.children(as(users.outsider), space.key, { limit: 2 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('moves a subtree under a new parent and rewrites every path', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('MOVE');
    const member = as(users.member);
    const a = await services.pages.create(member, { spaceId: space.id, title: 'A' });
    const b = await services.pages.create(member, { spaceId: space.id, title: 'B' });
    const a1 = await services.pages.create(member, {
      spaceId: space.id,
      parentId: a.id,
      title: 'A1',
    });
    const a11 = await services.pages.create(member, {
      spaceId: space.id,
      parentId: a1.id,
      title: 'A11',
    });
    const moved = await services.tree.move(member, a1.id, { parentId: b.id });
    expect(moved).toMatchObject({ movedCount: 2, page: { parentId: b.id, depth: 1 } });
    const [row] = await sql<{ path: string }[]>`select path from pages where id = ${a11.id}`;
    expect(row?.path).toBe(`/${b.id}/${a1.id}/${a11.id}/`);
    expect((await services.pages.get(member, a.id)).hasChildren).toBe(false);
    await expect(services.tree.move(member, b.id, { parentId: a11.id })).rejects.toBeInstanceOf(
      ConflictError,
    );
    const top = await services.tree.move(member, b.id, { parentId: null, beforeId: a.id });
    expect(top.page.position < a.position).toBe(true);
    await expect(
      services.tree.move(as(users.viewer), a.id, { parentId: b.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await harness.auditActions()).toContain('page.moved');
  });

  it('moves a page into another space the person can edit', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const from = await harness.space('FROM');
    const to = await harness.space('TO');
    const member = as(users.member);
    const page = await services.pages.create(member, { spaceId: from.id, title: 'Wanderer' });
    const child = await services.pages.create(member, { spaceId: from.id, parentId: page.id });
    const result = await services.tree.move(member, page.id, { spaceId: to.id, parentId: null });
    expect(result.page).toMatchObject({ spaceId: to.id, spaceKey: 'TO' });
    expect((await services.pages.get(member, child.id)).spaceId).toBe(to.id);
    const other = await services.spaces.create(as(users.admin), { key: 'PRIV', name: 'Private' });
    await expect(
      services.tree.move(member, page.id, { spaceId: other.id, parentId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('runs the review flow with reviewers and the publish capability', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('REV');
    const member = as(users.member);
    const page = await services.pages.create(member, { spaceId: space.id, title: 'Spec' });
    await expect(
      services.status.setStatus(member, page.id, { status: 'in_review' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      services.status.setReviewers(member, page.id, { reviewers: [users.outsider] }),
    ).rejects.toBeInstanceOf(ValidationError);
    const withReviewer = await services.status.setReviewers(member, page.id, {
      reviewers: [users.viewer],
    });
    expect(withReviewer.reviewers).toEqual([users.viewer]);
    const inReview = await services.status.setStatus(member, page.id, { status: 'in_review' });
    expect(inReview.status).toBe('in_review');
    await expect(
      services.status.setStatus(as(users.viewer), page.id, { status: 'published' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const published = await services.status.setStatus(member, page.id, { status: 'published' });
    expect(published.publishedAt).not.toBeNull();
    const archived = await services.status.setStatus(member, page.id, { status: 'archived' });
    await expect(
      services.status.setStatus(member, archived.id, { status: 'in_review' }),
    ).rejects.toBeInstanceOf(ConflictError);
    const [audit] = await sql<{ n: number }[]>`
      select count(*)::int as n from audit_log where action = 'page.status_changed'`;
    expect(audit?.n).toBe(3);
  });
});
