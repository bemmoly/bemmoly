import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* Moves, new spaces, template pages, search, labels and attention on the in-memory Docs. */

interface Row {
  id: string;
  title: string;
  name?: string;
  parentId?: string | null;
  depth?: number;
}
interface Listed {
  items: Row[];
}

const tree = (api: ReturnType<typeof createMockApi>, parentId?: string) =>
  (
    api.dispatch(
      'GET',
      `/api/v1/docs/spaces/ENG/tree${parentId ? `?parentId=${parentId}` : ''}`,
      undefined,
    )?.body as Listed
  ).items;

describe('the Docs mock backend, moves and lookups', () => {
  it('reorders and reparents pages, refusing a move into the subtree', () => {
    const api = createMockApi('ready');
    const [platform, postmortems] = tree(api);
    const moved = api.dispatch('POST', `/api/v1/docs/pages/${postmortems!.id}/move`, {
      parentId: null,
      beforeId: platform!.id,
    });
    expect(moved?.status).toBe(200);
    expect(tree(api).map((row) => row.title)).toEqual(['Postmortems', 'Platform']);

    const nested = api.dispatch('POST', `/api/v1/docs/pages/${postmortems!.id}/move`, {
      parentId: platform!.id,
    });
    expect(nested?.body).toMatchObject({ page: { parentId: platform!.id, depth: 1 } });
    expect(tree(api, platform!.id).at(-1)?.title).toBe('Postmortems');

    const loop = api.dispatch('POST', `/api/v1/docs/pages/${platform!.id}/move`, {
      parentId: postmortems!.id,
    });
    expect(loop?.status).toBe(422);
  });

  it('creates a space, refuses a taken key, and makes a page from a template', () => {
    const api = createMockApi('ready');
    const space = api.dispatch('POST', '/api/v1/docs/spaces', { key: 'OPS', name: 'Operations' });
    expect(space?.status).toBe(201);
    expect(api.dispatch('POST', '/api/v1/docs/spaces', { key: 'OPS', name: 'Again' })?.status).toBe(
      409,
    );
    const templates = (api.dispatch('GET', '/api/v1/docs/templates', undefined)?.body as Listed)
      .items;
    const made = api.dispatch('POST', `/api/v1/docs/templates/${templates[0]!.id}/pages`, {
      spaceId: (space?.body as { id: string }).id,
      parentId: null,
    });
    expect(made?.status).toBe(201);
    expect(made?.body).toMatchObject({ title: templates[0]!.name, templateId: templates[0]!.id });
  });

  it('searches pages, sets labels and lists docs pages for ⌘K', () => {
    const api = createMockApi('ready');
    const hits = api.dispatch('GET', '/api/v1/docs/search?q=postgres', undefined)?.body as Listed;
    expect(hits.items.length).toBeGreaterThan(0);
    const id = hits.items[0]!.id;
    expect(
      api.dispatch('PUT', `/api/v1/docs/pages/${id}/labels`, { labels: ['RFC', 'rfc', 'db'] })
        ?.body,
    ).toEqual({ labels: ['RFC', 'db'] });
    const labels = api.dispatch('GET', '/api/v1/docs/labels?q=d', undefined)?.body;
    expect(labels).toEqual({ items: [{ name: 'db', pageCount: 1 }] });
    const palette = api.dispatch('GET', '/api/v1/search?q=postgres', undefined)?.body as {
      items: Array<{ kind: string; href: string }>;
    };
    expect(palette.items.find((item) => item.kind === 'docs.page')?.href).toBe(`/docs/p/${id}`);
    expect(api.dispatch('GET', '/api/v1/docs/home/attention', undefined)?.body).toMatchObject({
      items: [],
      staleAfterDays: 90,
    });
  });
});
