import {
  ACCEPT_INVITATION_PATH,
  DEFAULT_ROLE_KEY,
  tokenLinkPath,
  type Invitation,
  type CreateInvitationsInput,
  type CreateModuleGrantInput,
  type CreateRoleInput,
  type PutRoleCapabilitiesInput,
  type UpdateUserInput,
  type User,
} from '@bemmoly/shared';
import { audit, can, emit, type MockDb } from '../db.ts';
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

/** As the server: SMTP with a host counts as configured; the log provider does not. */
const emailConfigured = (db: MockDb) =>
  db.settings['email.provider'] === 'smtp' && Boolean(db.settings['email.smtp.host']);

/** A fresh token for the invitation, as the accept link the admin can share. */
function issueLink(db: MockDb, invitation: Invitation) {
  for (const [token, id] of Object.entries(db.invitationTokens)) {
    if (id === invitation.id) delete db.invitationTokens[token];
  }
  const token = `invite-${newId().replaceAll('-', '')}`;
  db.invitationTokens[token] = invitation.id;
  const origin = globalThis.location?.origin ?? 'http://bemmoly.test';
  return { token, acceptUrl: new URL(tokenLinkPath(ACCEPT_INVITATION_PATH, token), origin).href };
}

/**
 * Like the server, an invitation is only an invitation: the person has no account, and no
 * user row, until they accept. A pending invitation to the same address is replaced.
 */
function invite(db: MockDb, email: string, roleId: string, teamId: string | undefined) {
  for (const pending of db.invitations) {
    if (pending.email === email && !pending.acceptedAt && !pending.revokedAt) {
      pending.revokedAt = new Date().toISOString();
    }
  }
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
  const { acceptUrl } = issueLink(db, invitation);
  capture(
    db,
    email,
    `You're invited to ${String(db.settings['workspace.name'] ?? 'Bemmoly')}`,
    `Accept: ${acceptUrl}`,
  );
  audit(db, 'invitation.created', 'invitation', invitation.id);
  return { ...invitation, acceptUrl };
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
      if (verb === 'deactivate' && user.id === db.signedInAs) {
        return fail(409, 'conflict', 'You cannot deactivate yourself.');
      }
      user.status = verb === 'deactivate' ? 'deactivated' : 'active';
      audit(db, `user.${verb}d`, 'user', user.id);
      return ok(user);
    }),
  })),
  {
    method: 'GET',
    pattern: '/api/v1/invitations',
    handle: needs(PEOPLE, (_, db) =>
      ok({ items: db.invitations.filter((item) => !item.acceptedAt && !item.revokedAt) }),
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/invitations',
    handle: needs(PEOPLE, (request, db) => {
      const body = bodyOf<CreateInvitationsInput>(request);
      if (!body.emails?.length) return invalid('emails', 'Add at least one email address');
      const roleId = body.roleId ?? db.roles.find((role) => role.key === DEFAULT_ROLE_KEY)?.id;
      if (!roleId) return invalid('roleId', 'Choose a role');
      if (body.emails.some((email) => db.users.some((user) => user.email === email))) {
        return fail(409, 'conflict', 'Some of these people already have accounts');
      }
      const items = body.emails.map((email) => invite(db, email, roleId, body.teamId));
      return ok({ items, emailConfigured: emailConfigured(db) }, 201);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/invitations/:id',
    handle: needs(PEOPLE, (request, db) => {
      const invitation = db.invitations.find((entry) => entry.id === request.params['id']);
      if (!invitation) return notFound('That invitation');
      invitation.revokedAt = new Date().toISOString();
      audit(db, 'invitation.revoked', 'invitation', invitation.id);
      return ok();
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/invitations/:id/links',
    handle: needs(PEOPLE, (request, db) => {
      const invitation = db.invitations.find(
        (entry) => entry.id === request.params['id'] && !entry.acceptedAt && !entry.revokedAt,
      );
      if (!invitation) return notFound('That invitation');
      invitation.expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const { acceptUrl } = issueLink(db, invitation);
      audit(db, 'invitation.link_issued', 'invitation', invitation.id);
      return ok({ ...invitation, acceptUrl }, 201);
    }),
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
