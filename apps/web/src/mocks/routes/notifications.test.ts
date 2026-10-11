import { notificationsPageSchema, type NotificationsPage } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The inbox mock answers views, the badge count and triage changes as the server does. */

const BASE = 'http://mock.local/api/v1/notifications';

function list(api: ReturnType<typeof createMockApi>, query = ''): NotificationsPage {
  return notificationsPageSchema.parse(api.dispatch('GET', `${BASE}${query}`, undefined)?.body);
}

const patch = (api: ReturnType<typeof createMockApi>, id: string, body: unknown) =>
  api.dispatch('PATCH', `${BASE}/${id}`, body);

describe('the inbox mock', () => {
  it('seeds a triage inbox across today, yesterday and earlier with four unread', () => {
    const api = createMockApi('ready');
    const inbox = list(api);
    expect(inbox.unreadCount).toBe(4);
    expect(inbox.items).toHaveLength(8);
    expect(new Set(inbox.items.map((item) => item.kind))).toEqual(
      new Set(['mention', 'review_request', 'assignment', 'comment', 'status_change']),
    );
    expect(inbox.items[0]).toMatchObject({ verb: 'requested your review on', read: false });
    expect(inbox.items.map((item) => item.target.url)).toContain('/work/issue/PLT-204');
    expect(inbox.items.find((item) => item.target.kind === 'page')?.target.url).toMatch(
      /^\/docs\/p\//,
    );
    expect(list(api, '?view=done').items.map((item) => item.id)).toEqual(['n-9', 'n-10']);
    expect(list(api, '?view=snoozed').items).toEqual([]);
  });

  it('marks done (and read), and undo brings an unread entry back unread', () => {
    const api = createMockApi('ready');
    expect(patch(api, 'n-3', { done: true })?.body).toEqual({
      ids: ['n-3', 'n-3-1'],
      done: true,
      read: true,
    });
    expect(list(api).items.map((item) => item.id)).not.toContain('n-3');
    expect(list(api).unreadCount).toBe(3);
    expect(list(api, '?view=done').items[0]).toMatchObject({ id: 'n-3', done: true, read: true });
    patch(api, 'n-3', { done: false });
    expect(list(api).items.find((item) => item.id === 'n-3')).toMatchObject({ read: false });
    expect(list(api).unreadCount).toBe(4);
    expect(api.db.outbound.at(-1)).toEqual(['notifications', api.db.signedInAs, ['n-3', 'n-3-1']]);
  });

  it('hides a snoozed entry until its time, then shows it unread; read-all leaves it be', () => {
    const api = createMockApi('ready');
    const until = new Date(Date.now() + 60 * 60_000).toISOString();
    expect(patch(api, 'n-4', { snoozedUntil: until })?.body).toMatchObject({
      read: false,
      snoozedUntil: until,
    });
    expect(list(api).items.map((item) => item.id)).not.toContain('n-4');
    expect(list(api, '?view=snoozed').items.map((item) => item.id)).toEqual(['n-4']);
    expect(list(api).unreadCount).toBe(4);

    api.dispatch('POST', `${BASE}/read-all`, undefined);
    expect(list(api).unreadCount).toBe(0);
    const entry = api.db.notifications.find((item) => item.id === 'n-4');
    if (!entry) throw new Error('n-4 missing');
    entry.snoozedUntil = new Date(Date.now() - 60_000).toISOString();
    expect(list(api).items.find((item) => item.id === 'n-4')).toMatchObject({ read: false });
    expect(list(api).unreadCount).toBe(1);
    patch(api, 'n-4', { snoozedUntil: null });
    expect(list(api, '?view=snoozed').items).toEqual([]);
  });

  it('rejects an empty change, an unknown view and an unknown entry', () => {
    const api = createMockApi('ready');
    expect(patch(api, 'n-1', {})?.status).toBe(400);
    expect(patch(api, 'n-1', undefined)?.status).toBe(400);
    expect(patch(api, 'missing', { read: true })?.status).toBe(404);
    expect(api.dispatch('GET', `${BASE}?view=later`, undefined)?.status).toBe(400);
    expect(patch(api, 'n-1', { read: true })?.body).toEqual({ ids: ['n-1'], read: true });
  });
});
