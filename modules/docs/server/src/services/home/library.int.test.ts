import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

describe('home, stars, labels and templates services', () => {
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

  it('stars pages per person and lists them newest first', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('STAR');
    const member = as(users.member);
    const first = await services.pages.create(member, { spaceId: space.id, title: 'First' });
    const second = await services.pages.create(member, { spaceId: space.id, title: 'Second' });
    await services.starsLabels.star(member, first.id, true);
    await services.starsLabels.star(member, second.id, true);
    await services.starsLabels.star(member, second.id, true);
    expect((await services.pages.get(member, first.id)).starred).toBe(true);
    expect((await services.pages.get(as(users.viewer), first.id)).starred).toBe(false);
    const starred = await services.home.starred(member, { limit: 1 });
    expect(starred.items.map((page) => page.title)).toEqual(['Second']);
    const more = await services.home.starred(member, {
      limit: 1,
      cursor: starred.nextCursor ?? undefined,
    });
    expect(more.items.map((page) => page.title)).toEqual(['First']);
    await services.starsLabels.star(member, second.id, false);
    expect((await services.home.starred(member, { limit: 10 })).items).toHaveLength(1);
    await expect(
      services.starsLabels.star(as(users.outsider), first.id, true),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lists recent pages only from spaces the person can open', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('RCNT');
    const hidden = await services.spaces.create(as(users.admin), { key: 'HIDE', name: 'Hidden' });
    await services.pages.create(as(users.admin), { spaceId: hidden.id, title: 'Secret' });
    const mine = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Mine',
    });
    const recent = await services.home.recent(as(users.member), { limit: 50, mine: false });
    const titles = recent.items.map((page) => page.title);
    expect(titles[0]).toBe('Mine');
    expect(titles).not.toContain('Secret');
    const own = await services.home.recent(as(users.viewer), { limit: 50, mine: true });
    expect(own.items.map((page) => page.id)).not.toContain(mine.id);
    const inSpace = await services.home.recent(as(users.admin), {
      limit: 50,
      mine: false,
      spaceId: hidden.id,
    });
    expect(inSpace.items.map((page) => page.title)).toEqual(['Secret']);
  });

  it('replaces labels case-insensitively and suggests the ones in use', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('LBL');
    const member = as(users.member);
    const page = await services.pages.create(member, { spaceId: space.id, title: 'Labelled' });
    const set = await services.starsLabels.setLabels(member, page.id, {
      labels: ['RFC', 'rfc', 'security'],
    });
    expect(set.labels).toEqual(['RFC', 'security']);
    const kept = await services.starsLabels.setLabels(member, page.id, { labels: ['rfc'] });
    expect(kept.labels).toEqual(['RFC']);
    expect((await services.pages.get(member, page.id)).labels).toEqual(['RFC']);
    const suggested = await services.starsLabels.suggestLabels(member, { q: 'r', limit: 10 });
    expect(suggested).toEqual([{ name: 'RFC', pageCount: 1 }]);
    await expect(
      services.starsLabels.setLabels(as(users.viewer), page.id, { labels: ['x'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lists built-in and space templates and creates a page from one', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('TMPL');
    const other = await harness.space('ELSE');
    const admin = as(users.admin);
    const member = as(users.member);
    const own = await services.templates.create(admin, {
      spaceId: space.id,
      name: 'ADR',
      snapshot: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    const listed = await services.templates.list(member, { spaceId: space.id });
    expect(listed.map((template) => template.name)).toEqual([
      'RFC',
      'Meeting notes',
      'Postmortem',
      'Product spec',
      'Runbook',
      'Decision log',
      'ADR',
    ]);
    const builtIn = listed[0]!;
    const page = await services.templates.createPage(member, builtIn.id, { spaceId: space.id });
    expect(page).toMatchObject({ title: 'RFC', templateId: builtIn.id, spaceId: space.id });
    await expect(
      services.templates.createPage(member, own.id, { spaceId: other.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      services.templates.create(member, {
        spaceId: space.id,
        name: 'No',
        snapshot: { type: 'doc' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(services.templates.remove(admin, builtIn.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(services.templates.remove(member, own.id)).rejects.toBeInstanceOf(ForbiddenError);
    await services.templates.remove(admin, own.id);
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining(['template.created', 'template.deleted']),
    );
  });
});
