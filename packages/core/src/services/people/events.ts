import {
  PERSON_CHANGED_FIELDS,
  PERSON_EVENT_KINDS,
  type EmploymentState,
  type Person,
  type PersonChangedField,
} from '@bemmoly/shared/people';
import type { Actor } from '../../contracts/authz.ts';
import type { PersonEvent } from '../../contracts/people.ts';

/** States in which someone is not (yet, or any longer) working here. */
const OUTSIDE: ReadonlySet<EmploymentState> = new Set(['offer_accepted', 'left']);

type Snapshot = Pick<Person, 'userId' | 'state' | 'startDate' | 'endDate' | PersonChangedField>;

/**
 * The events one write implies, in the order a reader expects: a join before the changes
 * that came with it, a change before the person starts leaving. `before` is null on create,
 * where nothing counts as changed.
 */
export function eventsFor(
  before: Snapshot | null,
  after: Snapshot,
  actor: Actor,
  occurredAt: Date,
): PersonEvent[] {
  const base = { occurredAt, actor, entity: { kind: 'person', id: after.userId } };
  const events: PersonEvent[] = [];
  const was = before?.state ?? null;
  if (after.state === 'active' && (was === null || OUTSIDE.has(was))) {
    events.push({
      ...base,
      kind: PERSON_EVENT_KINDS.joined,
      payload: {
        userId: after.userId,
        startDate: after.startDate,
        managerId: after.managerId,
        teamId: after.teamId,
        locationId: after.locationId,
      },
    });
  }
  if (before) {
    const fields = PERSON_CHANGED_FIELDS.filter((field) => before[field] !== after[field]);
    if (fields.length > 0) {
      const pick = (from: Snapshot) => Object.fromEntries(fields.map((f) => [f, from[f]]));
      events.push({
        ...base,
        kind: PERSON_EVENT_KINDS.changed,
        payload: { userId: after.userId, fields, before: pick(before), after: pick(after) },
      });
    }
  }
  if (after.state === 'leaving' && was !== 'leaving') {
    events.push({
      ...base,
      kind: PERSON_EVENT_KINDS.leaving,
      payload: { userId: after.userId, endDate: after.endDate, managerId: after.managerId },
    });
  }
  if (after.state === 'left' && was !== null && was !== 'left') {
    events.push({
      ...base,
      kind: PERSON_EVENT_KINDS.left,
      payload: { userId: after.userId, endDate: after.endDate, previousState: was },
    });
  }
  return events;
}
