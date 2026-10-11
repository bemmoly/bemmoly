import { audit, can, type MockDb } from '../db.ts';
import { fail, ok, type MockRoute } from '../types.ts';
import { policyAdmins, policyOf, ssoOf } from './sso.ts';

const CONFIGURE = 'workspace.sso.configure';

function change(db: MockDb, id: string | undefined, breakGlass: boolean) {
  if (!can(db, CONFIGURE)) {
    return fail(403, 'forbidden', 'You need the "Configure single sign-on" capability.');
  }
  const person = db.users.find((user) => user.id === id);
  if (!person) return fail(404, 'not_found', 'Person not found');
  if (person.isBreakGlass === breakGlass) return null;
  const admin = policyAdmins(db).find((entry) => entry.id === id);
  if (breakGlass && !admin) {
    return fail(409, 'conflict', 'Only active org admins can be break-glass admins');
  }
  if (breakGlass && !admin?.hasPassword) {
    return fail(
      409,
      'conflict',
      `${person.name} signs in only with single sign-on, so there is no password to fall back on`,
    );
  }
  const others = policyOf(db).breakGlassAdmins.filter((entry) => entry.id !== id);
  if (!breakGlass && ssoOf(db).requireSso && others.length === 0) {
    return fail(
      409,
      'conflict',
      `${person.name} is the last break-glass admin. Make someone else one first, or stop requiring single sign-on.`,
      { reason: 'last_break_glass_admin' },
    );
  }
  person.isBreakGlass = breakGlass;
  audit(db, breakGlass ? 'sso.break_glass_added' : 'sso.break_glass_removed', 'user', person.id);
  return null;
}

/** Marking and unmarking break-glass admins, with the server's rules. */
export const ssoBreakGlassRoutes: MockRoute[] = [
  {
    method: 'PUT',
    pattern: '/api/v1/admin/sso/break-glass-admins/:id',
    handle: (request, db) => change(db, request.params['id'], true) ?? ok(policyOf(db)),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/sso/break-glass-admins/:id',
    handle: (request, db) => change(db, request.params['id'], false) ?? ok(),
  },
];
