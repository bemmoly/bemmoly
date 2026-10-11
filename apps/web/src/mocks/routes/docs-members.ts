import { currentUser, type MockDb } from '../db.ts';
import { notFound, ok, type MockRoute } from '../types.ts';
import { docsState, spaceByRef } from './docs-state.ts';

/*
 * A space's people on the in-memory backend, in the Docs server's shape. The seed gives every
 * space everyone, so each person is a member with the role their workspace role names; the
 * reviewer picker offers the active ones, as the server does.
 */

const BASE = '/api/v1/docs';

function memberOf(db: MockDb, user: MockDb['users'][number]) {
  const role = db.roles.find((item) => item.id === user.roleId);
  const admin = role?.key === 'org_admin';
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roleId: user.roleId,
    roleKey: role?.key ?? 'member',
    roleName: role?.name ?? 'Member',
    access: admin ? 'org_admin' : 'member',
    canReview: user.status === 'active',
    addedAt: admin ? null : user.createdAt,
  };
}

function isOrgAdmin(db: MockDb): boolean {
  const user = currentUser(db);
  return db.roles.find((item) => item.id === user?.roleId)?.key === 'org_admin';
}

export const docsMemberRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/spaces/:spaceKey/members`,
    handle: (request, db) => {
      const space = spaceByRef(docsState(db), request.params['spaceKey'] ?? '');
      if (!space) return notFound(`Space ${request.params['spaceKey']}`);
      return ok({
        items: db.users.map((user) => memberOf(db, user)),
        roles: db.roles.map(({ id, key, name }) => ({ id, key, name })),
        canManage: isOrgAdmin(db),
      });
    },
  },
];
