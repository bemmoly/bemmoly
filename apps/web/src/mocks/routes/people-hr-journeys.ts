import { can, type MockDb } from '../db.ts';
import { addDays, type JourneyTemplate, type MockPeople } from '../seed/people-hr.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { peopleState, reportsOf } from './org.ts';

/* People's onboarding and offboarding journeys under /api/v1/hr. */

function summary(state: MockPeople, id: string) {
  const journey = state.journeys.find((j) => j.id === id)!;
  const tasks = state.tasks.filter((t) => t.journeyId === id);
  return { ...journey, taskCount: tasks.length, doneCount: tasks.filter((t) => t.doneAt).length };
}

const detail = (state: MockPeople, id: string) => ({
  ...summary(state, id),
  tasks: state.tasks
    .filter((t) => t.journeyId === id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
});

function mayView(db: MockDb, state: MockPeople, journeyId: string) {
  if (can(db, 'people.journeys.manage')) return true;
  const me = db.signedInAs ?? '';
  const journey = state.journeys.find((j) => j.id === journeyId);
  return Boolean(
    journey &&
    (journey.userId === me ||
      reportsOf(state, me, true).some((p) => p.userId === journey.userId) ||
      state.tasks.some((t) => t.journeyId === journeyId && t.ownerId === me)),
  );
}

export const peopleJourneyRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/hr/journey-templates',
    handle: (_, db) => ok({ items: peopleState(db).templates }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/journey-templates',
    handle: (request, db) => {
      if (!can(db, 'people.settings.manage'))
        return fail(403, 'forbidden', 'Only People admins can change templates');
      const body = bodyOf<JourneyTemplate>(request);
      const template: JourneyTemplate = {
        id: newId(),
        name: body.name ?? '',
        kind: body.kind ?? 'onboarding',
        locationId: body.locationId ?? null,
        jobTitle: body.jobTitle ?? null,
        tasks: body.tasks ?? [],
        archived: false,
      };
      peopleState(db).templates.push(template);
      return ok(template, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hr/journey-templates/:id',
    handle: (request, db) => {
      const template = peopleState(db).templates.find((t) => t.id === request.params.id);
      if (!template) return notFound('That template');
      Object.assign(template, bodyOf(request));
      return ok(template);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/journeys',
    handle: (request, db) => {
      const state = peopleState(db);
      const open = request.query.get('open');
      const items = state.journeys
        .filter((j) => open === null || (j.state === 'open') === (open === 'true'))
        .filter((j) => mayView(db, state, j.id))
        .map((j) => summary(state, j.id));
      return ok({ items });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/journeys',
    handle: (request, db) => {
      if (!can(db, 'people.journeys.manage'))
        return fail(403, 'forbidden', 'Only people who run journeys can start one');
      const state = peopleState(db);
      const body = bodyOf<{ userId: string; templateId: string; anchorDate: string }>(request);
      const person = state.persons.find((p) => p.userId === body.userId);
      const template = state.templates.find((t) => t.id === body.templateId);
      if (!person || !template) return notFound('That person or template');
      if (
        state.journeys.some(
          (j) => j.userId === person.userId && j.kind === template.kind && j.state === 'open',
        )
      ) {
        return fail(409, 'conflict', `${person.name} already has an open ${template.kind} journey`);
      }
      const id = newId();
      const anchor = body.anchorDate ?? new Date().toISOString().slice(0, 10);
      state.journeys.push({
        id,
        userId: person.userId,
        kind: template.kind,
        templateId: template.id,
        templateName: template.name,
        anchorDate: anchor,
        state: 'open',
        createdAt: new Date().toISOString(),
      });
      for (const task of template.tasks) {
        const ownerId =
          task.owner.type === 'person'
            ? person.userId
            : task.owner.type === 'manager'
              ? person.managerId
              : task.owner.userId;
        state.tasks.push({
          id: newId(),
          journeyId: id,
          title: task.title,
          ownerId,
          dueDate: addDays(anchor, task.offsetDays),
          doneAt: null,
          doneBy: null,
        });
      }
      return ok(detail(state, id), 201);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/journeys/:id',
    handle: (request, db) => {
      const state = peopleState(db);
      const id = request.params.id ?? '';
      if (!state.journeys.some((j) => j.id === id)) return notFound('That journey');
      if (!mayView(db, state, id))
        return fail(403, 'forbidden', 'You are not part of this journey');
      return ok(detail(state, id));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/journey-tasks',
    handle: (_, db) => {
      const state = peopleState(db);
      const items = state.tasks
        .filter((t) => t.ownerId === db.signedInAs && !t.doneAt)
        .map((t) => {
          const journey = state.journeys.find((j) => j.id === t.journeyId)!;
          return { ...t, journeyUserId: journey.userId, kind: journey.kind };
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return ok({ items });
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hr/journey-tasks/:id',
    handle: (request, db) => {
      const state = peopleState(db);
      const task = state.tasks.find((t) => t.id === request.params.id);
      if (!task) return notFound('That task');
      const body = bodyOf<{ done: boolean; ownerId: string }>(request);
      const manager = can(db, 'people.journeys.manage');
      if (body.ownerId !== undefined && !manager)
        return fail(403, 'forbidden', 'Only people who run journeys can hand a task on');
      if (body.done !== undefined && !manager && task.ownerId !== db.signedInAs) {
        return fail(403, 'forbidden', 'Only the task’s owner can tick it');
      }
      if (body.ownerId !== undefined) task.ownerId = body.ownerId;
      if (body.done !== undefined) {
        task.doneAt = body.done ? new Date().toISOString() : null;
        task.doneBy = body.done ? db.signedInAs : null;
      }
      const journey = state.journeys.find((j) => j.id === task.journeyId)!;
      journey.state = state.tasks.filter((t) => t.journeyId === journey.id).every((t) => t.doneAt)
        ? 'done'
        : 'open';
      return ok(detail(state, journey.id));
    },
  },
];
