import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { DOCS_SPACE_IDS } from '../seed/docs.ts';

/* The Docs handlers answer in the Docs server's shapes, so the Docs screens run on mocks. */

interface Listed {
  items: Array<{ id: string; title: string; key?: string; depth?: number }>;
  nextCursor: string | null;
}

describe('the Docs mock backend', () => {
  it('ships Docs enabled for everyone in the seeded workspace', () => {
    const api = createMockApi('ready');
    const docs = api.db.manifests.find((manifest) => manifest.id === 'docs');
    expect(docs?.navigation.find((nav) => nav.placement === 'top')?.path).toBe('/docs');
    expect(api.db.grants.filter((grant) => grant.moduleId === 'docs')).toMatchObject([
      { subjectKind: 'everyone' },
    ]);
  });

  it('lists spaces, a level of the tree and a page with its trail', () => {
    const api = createMockApi('ready');
    const spaces = api.dispatch('GET', '/api/v1/docs/spaces', undefined)?.body as Listed;
    expect(spaces.items.map((space) => space.key)).toEqual(['ENG', 'PROD', 'HB', 'DES']);
    const roots = api.dispatch('GET', '/api/v1/docs/spaces/eng/tree', undefined)?.body as Listed;
    expect(roots.items.map((page) => page.title)).toEqual(['Platform', 'Postmortems']);
    const platform = roots.items[0]!;
    const children = api.dispatch(
      'GET',
      `/api/v1/docs/spaces/ENG/tree?parentId=${platform.id}`,
      undefined,
    )?.body as Listed;
    expect(children.items.map((page) => page.depth)).toEqual([1, 1]);
    const rfc = api.dispatch('GET', `/api/v1/docs/pages/${children.items[0]!.id}`, undefined)?.body;
    expect(rfc).toMatchObject({
      title: 'RFC: Move sessions to Postgres',
      breadcrumbs: [{ id: platform.id, title: 'Platform' }],
      labels: ['rfc'],
    });
  });

  it('creates, stars, deletes and restores a page', () => {
    const api = createMockApi('ready');
    const created = api.dispatch('POST', '/api/v1/docs/pages', {
      spaceId: DOCS_SPACE_IDS.product,
      title: 'Launch checklist',
    });
    expect(created?.status).toBe(201);
    const id = (created?.body as { id: string }).id;
    api.dispatch('PUT', `/api/v1/docs/pages/${id}/star`, undefined);
    const starred = api.dispatch('GET', '/api/v1/docs/home/starred', undefined)?.body as Listed;
    expect(starred.items.map((page) => page.id)).toEqual([id]);
    const recent = api.dispatch('GET', '/api/v1/docs/home/recent', undefined)?.body as Listed;
    expect(recent.items[0]?.id).toBe(id);
    expect(api.dispatch('DELETE', `/api/v1/docs/pages/${id}`, undefined)?.status).toBe(204);
    expect(api.dispatch('GET', `/api/v1/docs/pages/${id}`, undefined)?.status).toBe(404);
    expect(api.dispatch('POST', `/api/v1/docs/pages/${id}/restore`, undefined)?.status).toBe(200);
    expect(api.dispatch('GET', `/api/v1/docs/pages/${id}`, undefined)?.status).toBe(200);
  });

  it('moves the body edit time for a body, not for a status change', () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T09:00:00.000Z') });
    try {
      const api = createMockApi('ready');
      const created = api.dispatch('POST', '/api/v1/docs/pages', {
        spaceId: DOCS_SPACE_IDS.product,
        title: 'Edit times',
      })?.body as { id: string; contentUpdatedAt: string };
      const page = `/api/v1/docs/pages/${created.id}`;
      const read = () =>
        api.dispatch('GET', page, undefined)?.body as {
          contentUpdatedAt: string;
          updatedAt: string;
          version: number;
        };
      vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'));
      api.dispatch('PUT', `${page}/status`, { status: 'in_review' });
      expect(read()).toMatchObject({
        contentUpdatedAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      });
      vi.setSystemTime(new Date('2026-10-01T11:00:00.000Z'));
      const { version } = read();
      const text = { type: 'text', text: 'two words' };
      const snapshot = { type: 'doc', content: [{ type: 'paragraph', content: [text] }] };
      expect(api.dispatch('PATCH', page, { snapshot })?.body).toMatchObject({
        snapshot,
        wordCount: 2,
        version,
        contentUpdatedAt: '2026-10-01T11:00:00.000Z',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
