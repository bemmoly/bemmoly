import { ConflictError } from '@bemmoly/shared';
import { and, asc, eq, exists, ne } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authIdentities, authProviders, roles, users } from '../../models/identity/index.ts';
import { ORG_ADMIN_ROLE_KEY } from '../authz/index.ts';
import { isPasswordSignInOff } from './accounts.ts';

/** The person has a password sign-in to fall back on. */
const hasPasswordIdentity = (db: Database) =>
  exists(
    db
      .select({ id: authIdentities.id })
      .from(authIdentities)
      .innerJoin(authProviders, eq(authProviders.id, authIdentities.providerId))
      .where(and(eq(authIdentities.userId, users.id), eq(authProviders.kind, 'password'))),
  );

/**
 * Break-glass admins who could sign in right now if the identity provider were down: active
 * org admins, flagged, with a password. `excluding` asks who would be left without one person.
 */
export async function breakGlassAdmins(db: Database, excluding?: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.isBreakGlass, true),
        eq(users.status, 'active'),
        eq(roles.key, ORG_ADMIN_ROLE_KEY),
        hasPasswordIdentity(db),
        ...(excluding ? [ne(users.id, excluding)] : []),
      ),
    )
    .orderBy(asc(users.name), asc(users.id));
}

/** Every active org admin, flagged or not, for Settings › Sign-in and SSO. */
export async function orgAdminsForPolicy(db: Database) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      breakGlass: users.isBreakGlass,
      hasPassword: hasPasswordIdentity(db).mapWith(Boolean),
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.status, 'active'), eq(roles.key, ORG_ADMIN_ROLE_KEY)))
    .orderBy(asc(users.name), asc(users.id));
}

/**
 * While single sign-on is required at least one break-glass admin must remain, or nobody can
 * sign in when the identity provider is down. Throws if taking this person away (unflagging,
 * demoting or deactivating them) would leave none.
 */
export async function assertBreakGlassRemains(
  db: Database,
  user: { id: string; name: string },
): Promise<void> {
  if (!(await isPasswordSignInOff(db))) return;
  const current = await breakGlassAdmins(db);
  if (!current.some((admin) => admin.id === user.id)) return;
  if ((await breakGlassAdmins(db, user.id)).length === 0) {
    throw new ConflictError(
      `${user.name} is the last break-glass admin. Make someone else one first, or stop requiring single sign-on.`,
      { details: { reason: 'last_break_glass_admin' } },
    );
  }
}
