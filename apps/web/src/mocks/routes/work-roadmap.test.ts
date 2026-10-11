import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The roadmap mock draws the Roadmap mock's plan, forecasts it and takes reschedules. */

const BASE = 'http://mock.local/api/v1/work';

interface Item {
  id: string;
  kind: string;
  key: string | null;
  title: string;
  start: string | null;
  end: string | null;
  progress: { total: number; done: number };
  forecast: { state: string; likely: string | null; waitsOn: string[]; explanation: string[] };
}

interface View {
  today: string;
  projects: Array<{ key: string; history: { samples: number[] } | null }>;
  items: Item[];
  dependencies: Array<{ fromId: string; toId: string }>;
}

const read = (api: ReturnType<typeof createMockApi>, query = '') =>
  api.dispatch('GET', `${BASE}/roadmap${query}`, undefined)?.body as View;

describe('the roadmap mock', () => {
  it('lays out Platform Core’s epics and versions with their forecasts', () => {
    const view = read(createMockApi('ready'), '?projects=PLT');
    expect(view.projects.map((project) => project.key)).toEqual(['PLT']);
    const titles = view.items.map((item) => item.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Auth service',
        'Billing v2',
        'Observability',
        'Self-serve onboarding',
        'v1.3.0',
        'v1.4.0',
      ]),
    );
    const billing = view.items.find((item) => item.title === 'Billing v2');
    const observability = view.items.find((item) => item.title === 'Observability');
    expect(billing?.start).not.toBeNull();
    expect(billing?.forecast.likely).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(view.dependencies).toEqual(
      expect.arrayContaining([
        { id: expect.any(String), fromId: billing?.id, toId: observability?.id },
      ]),
    );
    expect(observability?.forecast.waitsOn).toEqual([billing?.id]);
    expect(observability?.forecast.state).not.toBe('no_forecast');
  });

  it('groups across projects, with a dependency from one to the other', () => {
    const view = read(createMockApi('ready'));
    expect(view.projects.map((project) => project.key)).toEqual(
      expect.arrayContaining(['PLT', 'MOB', 'SUP']),
    );
    const auth = view.items.find((item) => item.title === 'Auth service');
    const offline = view.items.find((item) => item.title === 'Offline mode');
    expect(offline?.progress).toMatchObject({ total: 4, done: 1 });
    expect(offline?.forecast.waitsOn).toEqual([auth?.id]);
    expect(view.items.find((item) => item.title === 'Push notifications v2')?.forecast.state).toBe(
      'on_track',
    );
  });

  it('answers the same forecast every time and says no project for an unknown key', () => {
    const api = createMockApi('ready');
    expect(read(api).items).toEqual(read(api).items);
    expect(api.dispatch('GET', `${BASE}/roadmap?projects=NOPE`, undefined)?.status).toBe(404);
  });

  it('moves an epic through the issue PATCH and a version through its own', () => {
    const api = createMockApi('ready');
    const before = read(api, '?projects=PLT');
    const billing = before.items.find((item) => item.title === 'Billing v2');
    api.dispatch('PATCH', `${BASE}/issues/${billing?.key}`, {
      startAt: '2026-09-29',
      customFields: { target_date: '2026-10-28' },
    });
    const after = read(api, '?projects=PLT').items.find((item) => item.id === billing?.id);
    expect([after?.start, after?.end]).toEqual(['2026-09-29', '2026-10-28']);

    const version = before.items.find((item) => item.kind === 'version');
    const moved = api.dispatch('PATCH', `${BASE}/projects/PLT/versions/${version?.id}`, {
      startAt: '2026-10-01',
      releaseAt: '2026-11-20',
    });
    expect(moved?.status).toBe(200);
    const refused = api.dispatch('PATCH', `${BASE}/projects/PLT/versions/${version?.id}`, {
      startAt: '2026-12-01',
    });
    expect(refused?.status).toBe(400);
  });
});
