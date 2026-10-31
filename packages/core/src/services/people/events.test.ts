import { describe, expect, it } from 'vitest';
import type { Actor } from '../../contracts/authz.ts';
import { eventsFor } from './events.ts';

const actor: Actor = { kind: 'user', id: 'admin' };
const at = new Date('2026-10-22T09:00:00.000Z');
const base = {
  userId: '0199f000-0000-7000-8000-000000000001',
  state: 'offer_accepted' as const,
  startDate: '2026-11-02',
  endDate: null,
  jobTitle: 'Engineer',
  level: 'L3',
  managerId: null,
  teamId: null,
  locationId: null,
  costCentreId: null,
};
const kinds = (before: typeof base | null, after: object) =>
  eventsFor(before, { ...base, ...after }, actor, at).map((event) => event.kind);

describe('person events', () => {
  it('announces a join when someone becomes active from outside', () => {
    expect(kinds(null, { state: 'active' })).toEqual(['person.joined']);
    expect(kinds(base, { state: 'active' })).toEqual(['person.joined']);
    expect(kinds({ ...base, state: 'left' } as never, { state: 'active' })).toEqual([
      'person.joined',
    ]);
    expect(kinds({ ...base, state: 'on_leave' } as never, { state: 'active' })).toEqual([]);
  });

  it('says nothing for a new offer', () => {
    expect(kinds(null, {})).toEqual([]);
  });

  it('reports only the fields that changed, with before and after', () => {
    const [event] = eventsFor(
      base,
      { ...base, managerId: '0199f000-0000-7000-8000-000000000002', level: 'L3' },
      actor,
      at,
    );
    expect(event).toMatchObject({
      kind: 'person.changed',
      occurredAt: at,
      actor,
      entity: { kind: 'person', id: base.userId },
      payload: {
        fields: ['managerId'],
        before: { managerId: null },
        after: { managerId: '0199f000-0000-7000-8000-000000000002' },
      },
    });
  });

  it('orders a join before its changes and a change before leaving', () => {
    expect(kinds(base, { state: 'active', jobTitle: 'Senior engineer' })).toEqual([
      'person.joined',
      'person.changed',
    ]);
    const active = { ...base, state: 'active' } as never;
    expect(
      kinds(active, { state: 'leaving', endDate: '2026-12-31', teamId: null, level: 'L4' }),
    ).toEqual(['person.changed', 'person.leaving']);
  });

  it('announces leaving once and left with the state it came from', () => {
    const leaving = { ...base, state: 'leaving' } as never;
    expect(kinds(leaving, { state: 'leaving' })).toEqual([]);
    const [left] = eventsFor(leaving, { ...base, state: 'left', endDate: '2026-12-31' }, actor, at);
    expect(left).toMatchObject({
      kind: 'person.left',
      payload: { endDate: '2026-12-31', previousState: 'leaving' },
    });
  });
});
