import type {
  CreateInvitationsInput,
  CreateModuleGrantInput,
  CreateRoleInput,
  CreateTeamInput,
  PutRoleCapabilitiesInput,
  UpdateUserInput,
  User,
} from '@bemmoly/shared';
import { audit, can, emit, type MockDb } from '../db.ts';
import { makeUser } from '../seed/people.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, invalid, notFound, ok, page, type MockRoute } from '../types.ts';
import { capture } from './session.ts';

const PEOPLE = 'workspace.roles.manage';
const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Manage org roles" capability to do that.');

/** Wraps a handler so it answers 403 without the capability, as the server does. */
const needs =
  (capability: string, handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, capability) ? handle(request, db) : forbidden();

function filterUsers(db: MockDb, query: URLSearchParams): User[] {
  const q = query.get('q')?.toLowerCase();
  const status = query.get('status');
  return db.users.filter(
    (user) =>
      (!q || user.name.toLowerCase().includes(q) || user.email.includes(q)) &&
      (!status || user.status === status),
  );
}

function invite(db: MockDb, email: string, roleId: string, teamId: string | undefined) {
  const token = `invite-${newId().replaceAll('-', '')}`;
  const invitation = {
    id: newId(),
    email,
    roleId,
    teamId: teamId ?? null,
    invitedBy: db.signedInAs,
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.invitations.push(invitation);
  db.invitationTokens[token] = invitation.id;
  if (!db.users.some((user) => user.email === email)) {
    db.users.push({
      ...makeUser(newId(), email.split('@')[0] ?? email, email, roleId),
      status: 'invited',
      lastSeenAt: null,
      teamIds: teamId ? [teamId] : [],
    });
  }
  capture(
    db,
    email,
    `You're invited to ${String(db.settings['workspace.name'] ?? 'Bemmoly')}`,
    `Accept: /accept-invitation#token=${token}`,
  );
  audit(db, 'user.invited', 'invitation', email);
  return invitation;
}

function matrix(db: MockDb) {
  return {
    roles: db.roles,
    items: db.capabilities.map((row) => ({ ...row, cells: db.cells[row.name] ?? {} })),
  };
}

export const peopleRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/users',
    handle: (request, db) => ok(page(filterUsers(db, request.query), request)),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/users/:id',
    handle: (request, db) => {
      const user = db.users.find((entry) => entry.id === request.params['id']);
      if (!user) return notFound('That person');
      const body = bodyOf<UpdateUserInput>(request);
      if (body.roleId && !can(db, PEOPLE)) return forbidden();
      Object.assign(user, body);
      audit(db, body.roleId ? 'user.role_changed' : 'user.updated', 'user', user.id);
      emit(db, 'user.updated', [user.id]);
      return ok(user);
    },
  },
  ...(['deactivate', 'reactivate'] as const).map((verb): MockRoute => ({
    method: 'POST',
    pattern: `/api/v1/users/:id/${verb}`,
    handle: needs(PEOPLE, (request, db) => {
      const user = db.users.find((entry) => entry.id === request.params['id']);
      if (!user) return notFound('That person');
      user.status = verb === 'deactivate' ? 'deactivated' : 'active';
      audit(db, `user.${verb}d`, 'user', user.id);
      return ok(user);
    }),
  })),
  {
    method: 'GET',
    pattern: '/api/v1/invitations',
    handle: (_, db) => ok({ items: db.invitations }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/invitations',
    handle: needs(PEOPLE, (request, db) => {
      const body = bodyOf<CreateInvitationsInput>(request);
      if (!body.emails?.length || !body.roleId)
        return invalid('emails', 'Add at least one email address');
      return ok(
        {
          items: body.emails.map((email) => invite(db, email, body.roleId as string, body.teamId)),
        },
        201,
      );
    }),
  },
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
    method: 'GET',
    pattern: '/api/v1/teams/:id/members',
    handle: (request, db) =>
      ok({ items: db.teamMembers.filter((member) => member.teamId === request.params['id']) }),
  },
  { method: 'GET', pattern: '/api/v1/roles', handle: (_, db) => ok({ items: db.roles }) },
  {
    method: 'POST',
    pattern: '/api/v1/roles',
    handle: needs(PEOPLE, (request, db) => {
      const body = bodyOf<CreateRoleInput>(request);
      if (!body.name?.trim()) return invalid('name', 'Name the role');
      const now = new Date().toISOString();
      const role = {
        id: newId(),
        key: body.name.trim().toLowerCase().replace(/\W+/g, '_'),
        name: body.name.trim(),
        isSystem: false,
        userCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.roles.push(role);
      for (const row of db.capabilities) {
        const source = body.copyFromRoleId ? db.cells[row.name]?.[body.copyFromRoleId] : undefined;
        (db.cells[row.name] ??= {})[role.id] = {
          allowed: source?.allowed ?? false,
          lockedByOrg: source?.lockedByOrg ?? false,
        };
      }
      audit(db, 'role.created', 'role', role.id);
      return ok(role, 201);
    }),
  },
  { method: 'GET', pattern: '/api/v1/capabilities', handle: (_, db) => ok(matrix(db)) },
  {
    method: 'PUT',
    pattern: '/api/v1/roles/:id/capabilities',
    handle: needs(PEOPLE, (request, db) => {
      const role = db.roles.find((entry) => entry.id === request.params['id']);
      if (!role) return notFound('That role');
      if (role.key === 'org_admin')
        return fail(403, 'forbidden', 'The Org admin role always holds every capability.');
      for (const item of bodyOf<PutRoleCapabilitiesInput>(request).items ?? []) {
        const cell = ((db.cells[item.capability] ??= {})[role.id] ??= {
          allowed: false,
          lockedByOrg: false,
        });
        cell.allowed = item.allowed;
        if (item.lockedByOrg !== undefined) cell.lockedByOrg = item.lockedByOrg;
      }
      audit(db, 'role.capabilities_updated', 'role', role.id);
      emit(db, 'role.updated', [role.id]);
      const items = db.capabilities.map((row) => ({
        capability: row.name,
        label: row.label,
        description: row.description,
        group: row.group,
        moduleId: row.moduleId,
        ...(db.cells[row.name]?.[role.id] ?? { allowed: false, lockedByOrg: false }),
      }));
      return ok({ roleId: role.id, items });
    }),
  },
  { method: 'GET', pattern: '/api/v1/module-grants', handle: (_, db) => ok({ items: db.grants }) },
  {
    method: 'POST',
    pattern: '/api/v1/module-grants',
    handle: needs(PEOPLE, (request, db) => {
      const body = bodyOf<CreateModuleGrantInput>(request);
      if (!body.moduleId || !body.subjectKind) return invalid('moduleId', 'Choose who gets access');
      const grant = {
        id: newId(),
        moduleId: body.moduleId,
        subjectKind: body.subjectKind,
        subjectId: body.subjectId ?? null,
        grantedBy: db.signedInAs,
        createdAt: new Date().toISOString(),
      };
      db.grants.push(grant);
      audit(db, 'module.access_granted', 'module', body.moduleId);
      return ok(grant, 201);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/module-grants/:id',
    handle: needs(PEOPLE, (request, db) => {
      db.grants = db.grants.filter((grant) => grant.id !== request.params['id']);
      return ok();
    }),
  },
];
