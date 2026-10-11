import { http, HttpResponse } from 'msw';
import type { SavedFilter } from '../../../shared/index.ts';

/*
 * A test-only filters backend for MSW, in the server's shapes: the signed-in
 * person, their teams and the saved filters, recording every write.
 */

export const ORIGIN = 'http://bemmoly.test';
export const ME = '018f0000-0000-7000-8000-000000000040';
const OTHER = '018f0000-0000-7000-8000-000000000041';
export const PLATFORM = '018f0000-0000-7000-8000-000000000020';
const GROWTH = '018f0000-0000-7000-8000-000000000022';
export const PROJECT = { id: '018f0000-0000-7000-8000-000000000900', key: 'PLT' };
const STAMP = '2026-10-01T10:00:00.000Z';

const filter = (n: number, owner: string, name: string, query: string, shared: string[]) => ({
  id: `018f0000-0000-7000-8000-0000000001f${n}`,
  ownerId: owner,
  projectId: PROJECT.id,
  name,
  query,
  sharedWith: shared,
  createdAt: STAMP,
  updatedAt: STAMP,
});

export function filtersBackend() {
  const state = {
    filters: [
      filter(1, ME, 'My open work', 'assignee = me', []),
      filter(2, OTHER, 'Waiting for review', 'status = "Code review"', [PLATFORM]),
    ] as SavedFilter[],
    writes: [] as Array<[string, unknown]>,
  };
  const user = {
    id: ME,
    email: 'rohan@acme.test',
    name: 'Rohan S.',
    avatarKey: null,
    status: 'active',
    isBreakGlass: false,
    roleId: '018f0000-0000-7000-8000-000000000001',
    teamIds: [PLATFORM],
    themePref: null,
    locale: null,
    timezone: null,
    lastSeenAt: null,
    createdAt: STAMP,
  };
  const workspace = {
    name: 'Acme',
    url: ORIGIN,
    aiEnabled: false,
    appearance: {
      theme: 'classic',
      brandColor: '#2456c9',
      font: 'plex',
      logoKey: '',
      mode: 'light',
      surfaces: 'neutral',
      memberModeSwitch: true,
      personalThemes: false,
    },
  };
  const team = (id: string, name: string) => ({
    id,
    name,
    color: null,
    leadUserId: null,
    defaultRoleId: null,
    memberCount: 3,
    createdAt: STAMP,
    updatedAt: STAMP,
  });
  const handlers = [
    http.get(`${ORIGIN}/api/v1/me`, () =>
      HttpResponse.json({ user, capabilities: [], modules: ['work'], workspace }),
    ),
    http.get(`${ORIGIN}/api/v1/teams`, () =>
      HttpResponse.json({
        items: [team(PLATFORM, 'Platform'), team(GROWTH, 'Growth')],
        nextCursor: null,
      }),
    ),
    http.get(`${ORIGIN}/api/v1/work/filters`, () => HttpResponse.json({ items: state.filters })),
    http.post(`${ORIGIN}/api/v1/work/filters`, async ({ request }) => {
      const body = (await request.json()) as Partial<SavedFilter>;
      state.writes.push(['POST', body]);
      const saved = { ...filter(9, ME, body.name ?? '', body.query ?? '', body.sharedWith ?? []) };
      state.filters.push(saved);
      return HttpResponse.json(saved, { status: 201 });
    }),
    http.patch(`${ORIGIN}/api/v1/work/filters/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Partial<SavedFilter>;
      state.writes.push(['PATCH', { id: params['id'], ...body }]);
      const row = state.filters.find((entry) => entry.id === params['id']);
      if (!row) return HttpResponse.json({ code: 'not_found', message: 'No' }, { status: 404 });
      Object.assign(row, body);
      return HttpResponse.json(row);
    }),
    http.delete(`${ORIGIN}/api/v1/work/filters/:id`, ({ params }) => {
      state.writes.push(['DELETE', params['id']]);
      state.filters = state.filters.filter((entry) => entry.id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return { state, handlers };
}

/** Points relative fetches at the backend's origin, as the shell's page would. */
export function useTestOrigin(): void {
  (window as { happyDOM?: { setURL(url: string): void } }).happyDOM?.setURL(`${ORIGIN}/`);
}
