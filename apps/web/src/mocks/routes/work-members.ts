import { can, currentUser, emit, type MockDb } from '../db.ts';
import { ROLE_IDS, USER_IDS } from '../seed/people.ts';
import { ago } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { projectOf } from './work-issues.ts';
import { PROJECT_CONFIGURE, type Row } from './work-state.ts';

/*
 * Project members on the in-memory backend, in the server's shapes: Rohan
 * created every seeded project and is its project admin, and the owning
 * team's people joined with the team's default role.
 */

interface Membership {
  userId: string;
  roleId: string;
  addedAt: string;
}

const states = new WeakMap<MockDb, Map<string, Membership[]>>();

function membersOf(db: MockDb, project: Row): Membership[] {
  let byProject = states.get(db);
  if (!byProject) {
    byProject = new Map();
    states.set(db, byProject);
  }
  let rows = byProject.get(project.id);
  if (!rows) {
    const teamId = project['teamId'] as string | null;
    const team = db.teams.find((row) => row.id === teamId);
    const fromTeam = teamId
      ? db.teamMembers.filter((row) => row.teamId === teamId).map((row) => row.userId)
      : [USER_IDS.priya, USER_IDS.aisha, USER_IDS.jonas];
    rows = [
      { userId: USER_IDS.rohan, roleId: ROLE_IDS.projectAdmin, addedAt: ago(60 * 24 * 14) },
      ...fromTeam
        .filter((userId) => userId !== USER_IDS.rohan)
        .map((userId) => ({
          userId,
          roleId: team?.defaultRoleId ?? ROLE_IDS.member,
          addedAt: ago(60 * 24 * 12),
        })),
    ];
    byProject.set(project.id, rows);
  }
  return rows;
}

function present(db: MockDb, row: Membership) {
  const user = db.users.find((item) => item.id === row.userId);
  const role = db.roles.find((item) => item.id === row.roleId);
  return {
    userId: row.userId,
    name: user?.name ?? 'Someone',
    email: user?.email ?? '',
    status: user?.status ?? 'active',
    roleId: row.roleId,
    roleKey: role?.key ?? 'member',
    roleName: role?.name ?? 'Member',
    addedAt: row.addedAt,
  };
}

const canManage = (db: MockDb, rows: Membership[]) =>
  can(db, PROJECT_CONFIGURE) ||
  rows.some((row) => row.userId === db.signedInAs && row.roleId === ROLE_IDS.projectAdmin);

const lastAdmin = (rows: Membership[], userId: string) =>
  rows.filter((row) => row.roleId === ROLE_IDS.projectAdmin).length === 1 &&
  rows.some((row) => row.userId === userId && row.roleId === ROLE_IDS.projectAdmin);

/** Resolves the project and the change's permission, or the error response. */
function forChange(request: MockRequest, db: MockDb) {
  const project = projectOf(db, request.params['key']);
  if (!project) return { error: notFound('Project') };
  const rows = membersOf(db, project);
  if (!canManage(db, rows)) {
    return { error: fail(403, 'forbidden', 'You need "Configure project" to change members.') };
  }
  return { project, rows };
}

const LAST_ADMIN = () => fail(409, 'conflict', 'A project needs at least one project admin');

export const workMembersRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:key/members',
    handle: (request, db) => {
      const project = projectOf(db, request.params['key']);
      if (!project) return notFound('Project');
      const rows = membersOf(db, project);
      const items = rows
        .map((row) => present(db, row))
        .sort((a, b) => a.name.localeCompare(b.name));
      const roles = db.roles.map(({ id, key, name }) => ({ id, key, name }));
      return ok({ items, roles, canManage: canManage(db, rows) && Boolean(currentUser(db)) });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/projects/:key/members',
    handle: (request, db) => {
      const change = forChange(request, db);
      if (change.error) return change.error;
      const body = bodyOf<{ userIds: string[]; teamIds: string[]; roleId: string }>(request);
      const fromTeams = (body.teamIds ?? []).flatMap((teamId) =>
        db.teamMembers.filter((row) => row.teamId === teamId).map((row) => row.userId),
      );
      const added: Membership[] = [];
      for (const userId of new Set([...(body.userIds ?? []), ...fromTeams])) {
        if (change.rows.some((row) => row.userId === userId)) continue;
        if (!db.users.some((user) => user.id === userId)) continue;
        const row = { userId, roleId: body.roleId ?? ROLE_IDS.member, addedAt: ago(0) };
        change.rows.push(row);
        added.push(row);
      }
      emit(
        db,
        'work.members',
        added.map((row) => row.userId),
      );
      return ok({ items: added.map((row) => present(db, row)) }, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/work/projects/:key/members/:userId',
    handle: (request, db) => {
      const change = forChange(request, db);
      if (change.error) return change.error;
      const userId = request.params['userId'] ?? '';
      const row = change.rows.find((item) => item.userId === userId);
      if (!row) return notFound('Member');
      const roleId = bodyOf<{ roleId: string }>(request).roleId ?? row.roleId;
      if (roleId !== row.roleId && lastAdmin(change.rows, userId)) return LAST_ADMIN();
      row.roleId = roleId;
      emit(db, 'work.members', [userId]);
      return ok(present(db, row));
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/work/projects/:key/members/:userId',
    handle: (request, db) => {
      const change = forChange(request, db);
      if (change.error) return change.error;
      const userId = request.params['userId'] ?? '';
      const index = change.rows.findIndex((item) => item.userId === userId);
      if (index < 0) return notFound('Member');
      if (lastAdmin(change.rows, userId)) return LAST_ADMIN();
      change.rows.splice(index, 1);
      emit(db, 'work.members', [userId]);
      return ok();
    },
  },
];
