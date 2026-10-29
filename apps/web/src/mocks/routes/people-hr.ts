import type { Person } from '@bemmoly/shared/people';
import { can, currentUser, roleOf, type MockDb } from '../db.ts';
import { addDays, type MockPeople } from '../seed/people-hr.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { managerChain, peopleState, reportsOf } from './org.ts';

/*
 * People's directory, profiles, profile fields and ladder under /api/v1/hr, as the module's
 * server answers them. Time off and journeys are in people-hr-leave.ts and
 * people-hr-journeys.ts.
 */

const today = () => new Date().toISOString().slice(0, 10);

/** Leaving, then joining, then away today, then away within two weeks. */
export function happening(state: MockPeople, person: Person) {
  const day = today();
  if (person.state === 'leaving' && person.endDate) {
    return { kind: 'leaving', date: person.endDate, until: null };
  }
  if (person.startDate && person.startDate >= day && person.startDate <= addDays(day, 45)) {
    return { kind: 'joining', date: person.startDate, until: null };
  }
  const away = state.requests
    .filter((r) => r.userId === person.userId && r.status === 'approved')
    .filter((r) => r.endDate >= day && r.startDate <= addDays(day, 14))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!away) return null;
  return {
    kind: away.startDate <= day ? 'away' : 'away_soon',
    date: away.startDate,
    until: away.endDate,
  };
}

const row = (state: MockPeople, person: Person) => ({
  ...person,
  happening: happening(state, person),
});

const roleKey = (db: MockDb) => roleOf(db, currentUser(db))?.key ?? '';
const visible = (db: MockDb, roles: readonly string[]) =>
  roles.length === 0 || roles.includes(roleKey(db));

function fieldsOf(db: MockDb, userId: string) {
  const state = peopleState(db);
  const definitions = state.fields.filter(
    (field) => !field.archived && visible(db, field.visibleTo),
  );
  const all = state.values[userId] ?? {};
  const values = Object.fromEntries(
    definitions.filter((f) => f.key in all).map((f) => [f.key, all[f.key]]),
  );
  return {
    definitions,
    values,
    canEdit: db.signedInAs === userId || can(db, 'people.profiles.edit'),
  };
}

export const peopleHrRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/hr/directory',
    handle: (request, db) => {
      const state = peopleState(db);
      const q = request.query.get('q')?.toLowerCase();
      const teamId = request.query.get('teamId');
      const locationId = request.query.get('locationId');
      const includeLeft = request.query.get('includeLeft') === 'true';
      const items = state.persons
        .filter((p) => includeLeft || p.state !== 'left')
        .filter(
          (p) => (!teamId || p.teamId === teamId) && (!locationId || p.locationId === locationId),
        )
        .filter(
          (p) =>
            !q || p.name.toLowerCase().includes(q) || (p.jobTitle ?? '').toLowerCase().includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => row(state, p));
      return ok({ items });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/profiles/:userId',
    handle: (request, db) => {
      const state = peopleState(db);
      const userId = request.params.userId ?? '';
      const person = state.persons.find((p) => p.userId === userId);
      if (!person) return notFound('That person');
      return ok({
        person: row(state, person),
        managers: managerChain(state, userId),
        reports: reportsOf(state, userId),
        fields: fieldsOf(db, userId),
      });
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/hr/profiles/:userId/fields',
    handle: (request, db) => {
      const userId = request.params.userId ?? '';
      if (db.signedInAs !== userId && !can(db, 'people.profiles.edit')) {
        return fail(403, 'forbidden', 'You can change your own profile fields only');
      }
      const state = peopleState(db);
      const values = bodyOf<{ values: Record<string, unknown> }>(request).values ?? {};
      const current = { ...(state.values[userId] ?? {}) };
      for (const [key, value] of Object.entries(values)) {
        if (value === null || value === '') delete current[key];
        else current[key] = value;
      }
      state.values[userId] = current;
      return ok(fieldsOf(db, userId));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/profile-fields',
    handle: (_, db) =>
      ok({
        items: peopleState(db).fields.filter(
          (f) => visible(db, f.visibleTo) || can(db, 'people.settings.manage'),
        ),
      }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/profile-fields',
    handle: (request, db) => {
      if (!can(db, 'workspace.settings.manage'))
        return fail(403, 'forbidden', 'Only workspace admins can add fields');
      const body = bodyOf<{
        key: string;
        label: string;
        kind: string;
        options: { value: string; label: string }[];
      }>(request);
      const state = peopleState(db);
      if (state.fields.some((f) => f.key === body.key))
        return fail(409, 'conflict', 'A field with that key exists');
      const field = {
        id: newId(),
        moduleId: 'people',
        entityType: 'person',
        key: body.key ?? '',
        label: body.label ?? '',
        description: null,
        kind: (body.kind ?? 'text') as 'text',
        required: false,
        options: body.options ?? [],
        validation: {},
        defaultValue: null,
        visibleTo: [],
        editableBy: [],
        position: state.fields.length,
        archived: false,
      };
      state.fields.push(field);
      return ok(field, 201);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/levels',
    handle: (_, db) =>
      ok({ items: [...peopleState(db).levels].sort((a, b) => a.position - b.position) }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/levels',
    handle: (request, db) => {
      if (!can(db, 'people.settings.manage'))
        return fail(403, 'forbidden', 'Only People admins can change levels');
      const body = bodyOf<{ name: string; description: string | null }>(request);
      const state = peopleState(db);
      const level = {
        id: newId(),
        name: body.name ?? '',
        description: body.description ?? null,
        position: state.levels.length,
      };
      state.levels.push(level);
      return ok(level, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hr/levels/:id',
    handle: (request, db) => {
      const level = peopleState(db).levels.find((l) => l.id === request.params.id);
      if (!level) return notFound('That level');
      Object.assign(level, bodyOf(request));
      return ok(level);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/hr/levels/:id',
    handle: (request, db) => {
      const state = peopleState(db);
      state.levels = state.levels.filter((l) => l.id !== request.params.id);
      return ok();
    },
  },
];
