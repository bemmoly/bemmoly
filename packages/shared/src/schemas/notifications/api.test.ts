import { describe, expect, it } from 'vitest';
import {
  notificationListQuerySchema,
  notificationPatchBodySchema,
  notificationSchema,
} from './api.ts';

describe('inbox triage schemas', () => {
  it('needs at least one of read, done or snoozedUntil in a change', () => {
    expect(notificationPatchBodySchema.safeParse({}).success).toBe(false);
    expect(notificationPatchBodySchema.safeParse({ archived: true }).success).toBe(false);
    expect(notificationPatchBodySchema.safeParse({ snoozedUntil: 'tomorrow' }).success).toBe(false);
    expect(notificationPatchBodySchema.parse({ done: true })).toEqual({ done: true });
    expect(notificationPatchBodySchema.parse({ snoozedUntil: null })).toEqual({
      snoozedUntil: null,
    });
    expect(
      notificationPatchBodySchema.parse({ snoozedUntil: '2026-10-11T09:00:00+05:30', read: false }),
    ).toEqual({ snoozedUntil: '2026-10-11T09:00:00+05:30', read: false });
  });

  it('lists the inbox view unless another is named', () => {
    expect(notificationListQuerySchema.parse({}).view).toBe('inbox');
    expect(notificationListQuerySchema.parse({ view: 'done' }).view).toBe('done');
    expect(notificationListQuerySchema.safeParse({ view: 'later' }).success).toBe(false);
  });

  it('reads an item from a server that predates triage as open', () => {
    const item = notificationSchema.parse({
      id: 'n-1',
      ids: ['n-1'],
      kind: 'mention',
      verb: 'mentioned you in',
      summary: 'Aisha K. mentioned you in PLT-204',
      actors: [],
      actorCount: 0,
      target: { kind: 'issue', id: 'PLT-204', label: null, url: null },
      body: '',
      read: true,
      createdAt: '2026-10-07T09:00:00Z',
    });
    expect(item).toMatchObject({ done: false, snoozedUntil: null });
  });
});
