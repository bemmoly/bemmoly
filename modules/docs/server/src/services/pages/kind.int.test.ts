import { ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileBody } from '../../../../shared/page-kind.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const report = fileBody({
  src: '/api/v1/files/0199c0de-0000-7000-8000-0000000000c1',
  name: 'q3.html',
  mime: 'text/html',
});

describe('page kinds', () => {
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

  it('makes folders with no body, and lists them with their kind', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('KND');
    const member = as(users.member);
    const folder = await services.pages.create(member, {
      spaceId: space.id,
      title: 'Runbooks',
      kind: 'folder',
    });
    expect(folder).toMatchObject({ kind: 'folder', snapshot: null });
    await services.pages.create(member, {
      spaceId: space.id,
      parentId: folder.id,
      title: 'Deploy',
    });
    const roots = await services.tree.children(member, space.key, { limit: 50 });
    expect(roots.items.find((row) => row.id === folder.id)).toMatchObject({
      kind: 'folder',
      hasChildren: true,
    });
    await expect(
      services.pages.create(member, {
        spaceId: space.id,
        title: 'Notes',
        kind: 'folder',
        snapshot: doc('Written'),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('turns an empty page into a folder and back, never one with writing', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('KN2');
    const member = as(users.member);
    const empty = await services.pages.create(member, { spaceId: space.id, title: 'Group' });
    expect((await services.pages.update(member, empty.id, { kind: 'folder' })).kind).toBe('folder');
    expect((await services.pages.update(member, empty.id, { kind: 'page' })).kind).toBe('page');
    const written = await services.pages.create(member, {
      spaceId: space.id,
      title: 'Plan',
      snapshot: doc('Ship it'),
    });
    await expect(
      services.pages.update(member, written.id, { kind: 'folder' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('keeps a file page to its one file', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('KN3');
    const member = as(users.member);
    const page = await services.pages.create(member, {
      spaceId: space.id,
      title: 'Q3 report',
      kind: 'file',
    });
    expect(page.kind).toBe('file');
    const shown = await services.pages.update(member, page.id, { snapshot: report });
    expect(shown.kind).toBe('file');
    await expect(
      services.pages.update(member, page.id, { snapshot: doc('A line under it') }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await services.pages.update(member, page.id, { kind: 'page' })).kind).toBe('page');
    expect((await services.pages.update(member, page.id, { kind: 'file' })).kind).toBe('file');
  });
});
