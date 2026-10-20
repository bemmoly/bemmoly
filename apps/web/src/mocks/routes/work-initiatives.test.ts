import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The initiatives mock: a program across two teams, its timeline, and its management. */

const BASE = 'http://mock.local/api/v1/work';

interface Initiative {
  id: string;
  name: string;
  archivedAt: string | null;
  epics: { total: number };
  projectIds: string[];
}

interface View {
  items: Array<{ id: string; key: string | null; kind: string }>;
  dependencies: Array<{ fromId: string; toId: string; via: string; conflict: boolean }>;
}

describe('the initiatives mock', () => {
  it('lists the seeded program with its epics across projects', () => {
    const api = createMockApi('ready');
    const page = api.dispatch('GET', `${BASE}/initiatives`, undefined)?.body as {
      items: Initiative[];
    };
    const [program] = page.items;
    expect(program?.name).toBe('Self-serve launch');
    expect(program?.epics.total).toBe(3);
    expect(program?.projectIds).toHaveLength(2);
  });

  it('draws only its epics, with a card-level dependency across teams', () => {
    const api = createMockApi('ready');
    const [program] = (
      api.dispatch('GET', `${BASE}/initiatives`, undefined)?.body as { items: Initiative[] }
    ).items;
    const view = api.dispatch('GET', `${BASE}/roadmap?initiative=${program?.id}`, undefined)
      ?.body as View;
    expect(view.items.map((item) => item.key).sort()).toEqual(['MOB-1', 'PLT-190', 'PLT-240']);
    expect(view.items.every((item) => item.kind === 'epic')).toBe(true);
    const mobile = view.items.find((item) => item.key === 'MOB-1');
    const onboarding = view.items.find((item) => item.key === 'PLT-240');
    expect(view.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: mobile?.id, toId: onboarding?.id, via: 'issue' }),
      ]),
    );
  });

  it('creates, links, refuses a repeat, unlinks and archives', () => {
    const api = createMockApi('ready');
    const created = api.dispatch('POST', `${BASE}/initiatives`, { name: 'Mobile GA' });
    expect(created?.status).toBe(201);
    const id = (created?.body as Initiative).id;
    const roadmap = api.dispatch('GET', `${BASE}/roadmap?projects=MOB`, undefined)?.body as View;
    const epic = roadmap.items.find((item) => item.kind === 'epic');
    const linked = api.dispatch('POST', `${BASE}/initiatives/${id}/epics`, { epicId: epic?.id });
    expect((linked?.body as Initiative).epics.total).toBe(1);
    expect(
      api.dispatch('POST', `${BASE}/initiatives/${id}/epics`, { epicId: epic?.id })?.status,
    ).toBe(409);
    expect(
      api.dispatch('DELETE', `${BASE}/initiatives/${id}/epics/${epic?.id}`, undefined)?.status,
    ).toBe(204);
    const archived = api.dispatch('POST', `${BASE}/initiatives/${id}/archive`, undefined);
    expect((archived?.body as Initiative).archivedAt).not.toBeNull();
    const bad = api.dispatch('PATCH', `${BASE}/initiatives/${id}`, {
      startAt: '2027-02-01',
      targetAt: '2027-01-01',
    });
    expect(bad?.status).toBe(400);
  });
});
