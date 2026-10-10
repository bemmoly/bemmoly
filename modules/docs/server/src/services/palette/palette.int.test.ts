import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PageDetail } from '../../../../shared/pages.ts';
import { startDocsHarness, type HarnessStart, type DocsHarness } from '../int-support.ts';
import { createPageSearchProvider } from './index.ts';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('page search and the Docs palette provider against Postgres', () => {
  let start: HarnessStart;
  let docs: DocsHarness;
  let rotation: PageDetail;

  beforeAll(async () => {
    start = await startDocsHarness();
    if (!start.available) return;
    docs = start.harness;
    const space = await docs.space('PAL');
    const hidden = await docs.services.spaces.create(docs.as(docs.users.admin), {
      key: 'HID',
      name: 'Hidden',
    });
    const member = docs.as(docs.users.member);
    rotation = await docs.services.pages.create(member, {
      spaceId: space.id,
      title: 'Token rotation',
      snapshot: doc('Rotate service credentials every ninety days.'),
    });
    await docs.services.pages.create(member, {
      spaceId: space.id,
      title: 'Onboarding',
      snapshot: doc('New engineers rotate through support in their first month.'),
    });
    const gone = await docs.services.pages.create(member, {
      spaceId: space.id,
      title: 'Rotation draft (deleted)',
    });
    await docs.services.pages.remove(member, gone.id);
    await docs.services.pages.create(docs.as(docs.users.admin), {
      spaceId: hidden.id,
      title: 'Hidden rotation',
    });
  });

  afterAll(async () => {
    if (start.available) await docs.stop();
  });

  it('ranks title hits over body hits and highlights the match', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const hits = await docs.services.search.search(docs.as(docs.users.member), {
      q: 'rotate',
      limit: 10,
    });
    expect(hits.map((hit) => hit.title)).toEqual(['Token rotation', 'Onboarding']);
    expect(hits[0]?.snippet).toContain('<b>');
  });

  it('answers the palette with pages from the person’s spaces, title matches first', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const provider = createPageSearchProvider(docs.services.search);
    const results = await provider.search(docs.as(docs.users.member), { q: 'token', limit: 8 });
    expect(results[0]).toEqual({
      id: rotation.id,
      key: 'PAL',
      title: 'Token rotation',
      subtitle: 'Draft',
      context: 'PAL',
      snippet: 'Rotate service credentials every ninety days',
      look: { icon: null },
      href: `/docs/p/${rotation.id}`,
    });
    const [onboarding] = await provider.search(docs.as(docs.users.member), {
      q: 'engineers',
      limit: 8,
    });
    expect(onboarding?.snippet).toContain('<b>engineers</b>');
    expect(onboarding?.snippet).not.toContain('Onboarding');
    const member = await provider.search(docs.as(docs.users.member), { q: 'rotation', limit: 8 });
    expect(member.map((result) => result.title)).toEqual(['Token rotation', 'Onboarding']);
    const admin = await provider.search(docs.as(docs.users.admin), { q: 'rotation', limit: 8 });
    expect(admin.map((result) => result.title).sort()).toEqual([
      'Hidden rotation',
      'Onboarding',
      'Token rotation',
    ]);
    const outsider = await provider.search(docs.as(docs.users.outsider), {
      q: 'rotation',
      limit: 8,
    });
    expect(outsider).toEqual([]);
  });

  it('refuses a search scoped to a space the person is not in', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [space] = await docs.sql<{ id: string }[]>`select id from spaces where key = 'PAL'`;
    await expect(
      docs.services.search.search(docs.as(docs.users.outsider), {
        q: 'rotate',
        spaceId: space!.id,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
