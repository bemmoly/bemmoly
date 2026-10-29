import type { Person } from '@bemmoly/shared/people';
import { audit, can, type MockDb } from '../db.ts';
import { seedPeopleHr, type MockPeople } from '../seed/people-hr.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';

/*
 * The kernel's person record and org data (ADR 0050): /api/v1/people, /locations and
 * /cost-centres. Reads for anyone signed in; writes need workspace.people.manage.
 */

export function peopleState(db: MockDb): MockPeople {
  db.peopleHr ??= seedPeopleHr();
  return db.peopleHr;
}

const MANAGE = 'workspace.people.manage';
const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Manage people records" capability to do that.');

/** Nearest manager first, as the server walks it. */
export function managerChain(state: MockPeople, userId: string): Person[] {
  const chain: Person[] = [];
  let at = state.persons.find((p) => p.userId === userId)?.managerId;
  while (at && chain.length < 20) {
    const manager = state.persons.find((p) => p.userId === at);
    if (!manager) break;
    chain.push(manager);
    at = manager.managerId;
  }
  return chain;
}

export function reportsOf(state: MockPeople, userId: string, all = false): Person[] {
  const direct = state.persons.filter((p) => p.managerId === userId);
  return all ? direct.flatMap((p) => [p, ...reportsOf(state, p.userId, true)]) : direct;
}

const now = () => new Date().toISOString();

function crud<T extends { id: string }>(
  path: string,
  list: (state: MockPeople) => T[],
  make: (body: Record<string, unknown>) => Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
): MockRoute[] {
  return [
    { method: 'GET', pattern: path, handle: (_, db) => ok({ items: list(peopleState(db)) }) },
    {
      method: 'POST',
      pattern: path,
      handle: (request, db) => {
        if (!can(db, MANAGE)) return forbidden();
        const item = {
          id: newId(),
          createdAt: now(),
          updatedAt: now(),
          ...make(bodyOf(request)),
        } as unknown as T;
        list(peopleState(db)).push(item);
        audit(db, `${path.split('/').pop()}.created`, 'org', item.id);
        return ok(item, 201);
      },
    },
    {
      method: 'PATCH',
      pattern: `${path}/:id`,
      handle: (request, db) => {
        if (!can(db, MANAGE)) return forbidden();
        const item = list(peopleState(db)).find((entry) => entry.id === request.params.id);
        if (!item) return notFound('That record');
        Object.assign(item, bodyOf(request), { updatedAt: now() });
        return ok(item);
      },
    },
  ];
}

export const orgRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/people',
    handle: (_, db) => ok({ items: peopleState(db).persons, nextCursor: null }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/people',
    handle: (request, db) => {
      if (!can(db, MANAGE)) return forbidden();
      const body = bodyOf<Person>(request);
      const user = db.users.find((u) => u.id === body.userId);
      if (!user) return notFound('That user');
      const state = peopleState(db);
      if (state.persons.some((p) => p.userId === user.id)) {
        return fail(409, 'conflict', 'That person already has a record');
      }
      const person: Person = {
        userId: user.id,
        name: user.name,
        email: user.email,
        state: body.state ?? 'offer_accepted',
        startDate: body.startDate ?? null,
        endDate: null,
        jobTitle: body.jobTitle ?? null,
        level: null,
        managerId: body.managerId ?? null,
        teamId: body.teamId ?? null,
        locationId: body.locationId ?? null,
        costCentreId: null,
        createdAt: now(),
        updatedAt: now(),
      };
      state.persons.push(person);
      audit(db, 'person.created', 'person', person.userId);
      return ok(person, 201);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/people/:userId',
    handle: (request, db) => {
      const found = peopleState(db).persons.find((p) => p.userId === request.params.userId);
      return found ? ok(found) : notFound('That person');
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/people/:userId',
    handle: (request, db) => {
      if (!can(db, MANAGE)) return forbidden();
      const found = peopleState(db).persons.find((p) => p.userId === request.params.userId);
      if (!found) return notFound('That person');
      Object.assign(found, bodyOf<Person>(request), { updatedAt: now() });
      audit(db, 'person.updated', 'person', found.userId);
      return ok(found);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/people/:userId/managers',
    handle: (request, db) =>
      ok({ items: managerChain(peopleState(db), request.params.userId ?? '') }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/people/:userId/reports',
    handle: (request, db) =>
      ok({
        items: reportsOf(
          peopleState(db),
          request.params.userId ?? '',
          request.query.get('all') === 'true',
        ),
      }),
  },
  ...crud(
    '/api/v1/locations',
    (s) => s.locations,
    (b) => ({
      name: String(b.name ?? ''),
      timezone: String(b.timezone ?? 'UTC'),
      countryCode: (b.countryCode as string | null | undefined)?.toUpperCase() ?? null,
      holidayCalendar: null,
    }),
  ),
  ...crud(
    '/api/v1/cost-centres',
    (s) => s.costCentres,
    (b) => ({
      code: String(b.code ?? ''),
      name: String(b.name ?? ''),
      ownerUserId: (b.ownerUserId as string | null | undefined) ?? null,
    }),
  ),
];
