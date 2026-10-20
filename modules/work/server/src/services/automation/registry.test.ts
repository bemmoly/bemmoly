import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { IssueEventPayload } from '../issues/events.ts';
import { findAction } from './actions/index.ts';
import { chainOf } from './engine.ts';
import {
  findTrigger,
  lastFireTime,
  SCHEDULED_TRIGGERS,
  STAY_TRIGGERS,
  triggersFor,
} from './triggers/index.ts';
import { assertValidRule } from './validate.ts';

const payload = (extra: Partial<IssueEventPayload> = {}): IssueEventPayload => ({
  summary: 'PLT-1 x was updated',
  url: '/work/issue/PLT-1',
  issue: {
    id: '0199c7a0-0000-7000-8000-000000000001',
    key: 'PLT-1',
    title: 'x',
    projectId: '0199c7a0-0000-7000-8000-000000000002',
    statusId: '0199c7a0-0000-7000-8000-000000000003',
    priority: 'medium',
    assigneeId: null,
    reporterId: null,
  },
  ...extra,
});

describe('the automation registries', () => {
  it('routes each issue event to the triggers that listen to it', () => {
    expect(triggersFor('issue.created')).toEqual(['issue_created']);
    expect(triggersFor('issue.updated')).toEqual(['field_changed']);
    expect(triggersFor('issue.transitioned')).toEqual(['issue_transitioned']);
    expect(triggersFor('issue.commented')).toEqual(['comment_added']);
    expect(triggersFor('page.published')).toEqual([]);
    expect(SCHEDULED_TRIGGERS).toEqual(['scheduled']);
  });

  it('matches field changes and status names without case', () => {
    const changed = findTrigger('field_changed')!;
    const event = { kind: 'issue.updated', payload: payload({ fields: ['priority', 'title'] }) };
    expect(changed.matches({ fields: ['priority'] }, event)).toBe(true);
    expect(changed.matches({ fields: ['assigneeId'] }, event)).toBe(false);
    const moved = findTrigger('issue_transitioned')!;
    const move = {
      kind: 'issue.transitioned',
      payload: payload({ fromStatus: 'In progress', toStatus: 'Done' }),
    };
    expect(moved.matches({ toStatus: 'done' }, move)).toBe(true);
    expect(moved.matches({ fromStatus: 'backlog', toStatus: 'done' }, move)).toBe(false);
    expect(moved.matches({}, move)).toBe(true);
  });

  it('finds the last fire time of a cron schedule in UTC', () => {
    const now = new Date('2026-10-12T09:30:00Z');
    expect(lastFireTime('0 9 * * 1', now)?.toISOString()).toBe('2026-10-12T09:00:00.000Z');
    expect(lastFireTime('0 9 * * 1', new Date('2026-10-12T09:00:00Z'))?.toISOString()).toBe(
      '2026-10-12T09:00:00.000Z',
    );
    expect(lastFireTime('not cron', now)).toBeNull();
  });

  it('builds the chain an event carries: its rule appended to the rules before it', () => {
    expect(chainOf({ kind: 'user', id: 'u' })).toEqual([]);
    expect(chainOf({ kind: 'automation', id: 'b', userId: 'u', chain: ['a'] })).toEqual(['a', 'b']);
  });

  it('validates every action’s arguments with its own schema', () => {
    expect(findAction('assign')!.params.safeParse({ to: 'reporter' }).success).toBe(true);
    expect(findAction('notify')!.params.safeParse({ message: 'Hi' }).success).toBe(false);
    expect(() =>
      assertValidRule({
        trigger: { name: 'scheduled', args: { cron: '0 9 * * 1' } },
        conditions: [],
        actions: [{ name: 'add_label', args: { label: 'weekly' } }],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertValidRule({
        trigger: { name: 'issue_created', args: {} },
        conditions: ['priority = high'],
        actions: [{ name: 'transition', args: { status: 'Done' } }],
      }),
    ).not.toThrow();
  });

  it('reads a time-in-status trigger as a status and a span, and listens to no event', () => {
    const trigger = findTrigger('time_in_status');
    expect(STAY_TRIGGERS).toEqual(['time_in_status']);
    expect(SCHEDULED_TRIGGERS).not.toContain('time_in_status');
    expect(trigger?.events).toEqual([]);
    const args = trigger!.params.parse({ status: 'Verification', amount: 5, unit: 'days' });
    expect(trigger?.stay?.(args)).toEqual({ status: 'Verification', ms: 5 * 24 * 3_600_000 });
    expect(trigger?.stay?.({ status: 'Review', amount: 3, unit: 'hours' })?.ms).toBe(3 * 3_600_000);
    expect(trigger?.params.safeParse({ status: 'x', amount: 1.5, unit: 'days' }).success).toBe(
      false,
    );
    expect(trigger?.params.safeParse({ status: 'x', amount: 2, unit: 'weeks' }).success).toBe(
      false,
    );
  });
});
