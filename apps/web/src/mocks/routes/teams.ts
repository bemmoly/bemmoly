import type { CreateTeamInput, UpdateTeamInput } from '@bemmoly/shared';
import { audit, can, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, invalid, ok, type MockRoute } from '../types.ts';

const PEOPLE = 'workspace.roles.manage';
const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Manage org roles" capability to do that.');

const needs =
  (capability: string, handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, capability) ? handle(request, db) : forbidden();

/** Puts someone on a team, as the server does for a new lead; a no-op when already there. */
function join(db: MockDb, teamId: string, userId: string) {
  if (db.teamMembers.some((row) => row.teamId === teamId && row.userId === userId)) return;
  db.teamMembers.push({ teamId, userId, createdAt: new Date().toISOString() });
  db.users.find((user) => user.id === userId)?.teamIds.push(teamId);
  const team = db.teams.find((row) => row.id === teamId);
  if (team) team.memberCount += 1;
}

/** Teams: list, create, edit, delete and their members, as the server answers them. */
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
        defaultRoleId: null,
        memberCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.teams.push(team);
      if (team.leadUserId) join(db, team.id, team.leadUserId);
      audit(db, 'team.created', 'team', team.id);
      return ok(team, 201);
    }),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/teams/:id',
    handle: needs(PEOPLE, (request, db) => {
      const team = db.teams.find((row) => row.id === request.params['id']);
      if (!team) return fail(404, 'not_found', 'That team no longer exists.');
      const body = bodyOf<UpdateTeamInput>(request);
      if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name) return invalid('name', 'Name the team');
        if (
          db.teams.some(
            (row) => row.id !== team.id && row.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          return fail(409, 'conflict', `A team called ${name} already exists.`);
        }
        team.name = name;
      }
      if (body.leadUserId !== undefined) {
        team.leadUserId = body.leadUserId;
        if (body.leadUserId) join(db, team.id, body.leadUserId);
      }
      team.updatedAt = new Date().toISOString();
      audit(db, 'team.updated', 'team', team.id);
      return ok(team);
    }),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/teams/:id/members/:userId',
    handle: needs(PEOPLE, (request, db) => {
      const teamId = request.params['id'] as string;
      if (!db.teams.some((row) => row.id === teamId)) {
        return fail(404, 'not_found', 'That team no longer exists.');
      }
      join(db, teamId, request.params['userId'] as string);
      audit(db, 'team.member_added', 'team', teamId);
      return ok();
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/teams/:id/members/:userId',
    handle: needs(PEOPLE, (request, db) => {
      const teamId = request.params['id'] as string;
      const userId = request.params['userId'] as string;
      const before = db.teamMembers.length;
      db.teamMembers = db.teamMembers.filter(
        (row) => !(row.teamId === teamId && row.userId === userId),
      );
      if (db.teamMembers.length === before) {
        return fail(404, 'not_found', 'This person is not on the team.');
      }
      const user = db.users.find((row) => row.id === userId);
      if (user) user.teamIds = user.teamIds.filter((id) => id !== teamId);
      const team = db.teams.find((row) => row.id === teamId);
      if (team) team.memberCount -= 1;
      audit(db, 'team.member_removed', 'team', teamId);
      return ok();
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
