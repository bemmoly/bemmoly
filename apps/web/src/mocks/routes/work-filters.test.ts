import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The saved filters mock answers as the server's filters service does. */

const W = 'http://mock.local/api/v1/work/filters';

interface Filter {
  id: string;
  name: string;
  ownerId: string;
}

const list = (api: ReturnType<typeof createMockApi>, query = '?projectId=PLT') =>
  (api.dispatch('GET', `${W}${query}`, undefined)?.body as { items: Filter[] }).items;

describe('the saved filters mock', () => {
  it("lists my own and my teams' filters, and only the owner changes one", () => {
    const api = createMockApi('ready');
    expect(list(api).map((filter) => filter.name)).toEqual(['My open work', 'Waiting for review']);
    const shared = list(api).find((filter) => filter.name === 'Waiting for review')!;
    expect(api.dispatch('DELETE', `${W}/${shared.id}`, undefined)?.status).toBe(403);
    expect(list(api, '?projectId=PLT&scope=mine').map((filter) => filter.name)).toEqual([
      'My open work',
    ]);
  });

  it('saves a valid query, renames and deletes it, and refuses one that does not parse', () => {
    const api = createMockApi('ready');
    const bad = api.dispatch('POST', W, { name: 'Broken', query: 'status = ' });
    expect(bad?.status).toBe(400);
    const saved = api.dispatch('POST', W, {
      name: 'Urgent',
      query: 'priority = Highest',
      projectId: 'PLT',
      sharedWith: [],
    })?.body as Filter;
    expect(api.dispatch('PATCH', `${W}/${saved.id}`, { name: 'On fire' })?.status).toBe(200);
    expect(list(api).map((filter) => filter.name)).toContain('On fire');
    expect(api.dispatch('DELETE', `${W}/${saved.id}`, undefined)?.status).toBe(204);
    expect(list(api).map((filter) => filter.name)).not.toContain('On fire');
  });
});
