import type { CreateTeamInput } from '@bemmoly/shared';
import { audit, can } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, invalid, ok, type MockRoute } from '../types.ts';

const PEOPLE = 'workspace.roles.manage';
const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Manage org roles" capability to do that.');

const needs =
  (capability: string, handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, capability) ? handle(request, db) : forbidden();

/** Teams: list, create, delete and their members, as the server answers them. */
export const teamRoutes: MockRoute[] = [
  { method: 'GET', pattern: '/api/v1/teams', handle: (_, db) => ok({ items: db.teams }) },
  {
    method: 'POST',
    pattern: '/api/v1/teams',
    handle: needs(PEOPLE, (request, db) => {
      const body = bodyOf<CreateTeamInput>(request);
      if (!body.name?.trim()) return invalid('name', 'Name the team');
      if (db.teams.some((team) => team.name.toLowerCase() === body.name?.toLowerCase())) {
        return fail(409, 'conflict', `A team called ${body.name} already exists.`);
      }
      const now = new Date().toISOString();
      const team = {
        id: newId(),
        name: body.name.trim(),
        color: body.color ?? null,
        leadUserId: body.leadUserId ?? null,
        defaultRoleId: body.defaultRoleId ?? null,
        memberCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.teams.push(team);
      audit(db, 'team.created', 'team', team.id);
      return ok(team, 201);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/teams/:id',
    handle: needs(PEOPLE, (request, db) => {
      const id = request.params['id'];
      const index = db.teams.findIndex((team) => team.id === id);
      if (index < 0) return fail(404, 'not_found', 'That team no longer exists.');
      db.teams.splice(index, 1);
      db.teamMembers = db.teamMembers.filter((member) => member.teamId !== id);
      for (const user of db.users) user.teamIds = user.teamIds.filter((teamId) => teamId !== id);
      audit(db, 'team.deleted', 'team', id as string);
      return ok();
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/teams/:id/members',
    handle: (request, db) =>
      ok({ items: db.teamMembers.filter((member) => member.teamId === request.params['id']) }),
  },
];
