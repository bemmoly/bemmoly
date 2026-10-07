import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  authIdentities,
  authProviders,
  roles,
  teamMembers,
  users,
  type UserRow,
} from '../../models/identity/index.ts';
import { ORG_ADMIN_ROLE_KEY, type RequestContext } from '../authz/index.ts';
import { hashPassword } from './passwords.ts';

export interface NewAccount {
  email: string;
  name: string;
  roleId: string;
  password: string;
  isBreakGlass?: boolean;
  teamId?: string | null;
}

async function passwordProviderId(db: Database): Promise<string> {
  const [provider] = await db
    .select({ id: authProviders.id })
    .from(authProviders)
    .where(eq(authProviders.kind, 'password'))
    .limit(1);
  if (!provider) throw new Error('The password provider row is missing; run the changelog');
  return provider.id;
}

export async function emailTaken(db: Database, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  return Boolean(row);
}

/** Creates an active person with a password sign-in, and their first team. */
export async function createAccount(db: Database, account: NewAccount): Promise<UserRow> {
  if (await emailTaken(db, account.email)) {
    throw new ConflictError('Someone already has an account with this email');
  }
  const passwordHash = await hashPassword(account.password);
  const [user] = await db
    .insert(users)
    .values({
      email: account.email,
      name: account.name,
      roleId: account.roleId,
      isBreakGlass: account.isBreakGlass ?? false,
      status: 'active',
    })
    .returning();
  if (!user) throw new Error('User insert returned no row');
  await db.insert(authIdentities).values({
    userId: user.id,
    providerId: await passwordProviderId(db),
    subject: user.id,
    passwordHash,
  });
  if (account.teamId) {
    await db.insert(teamMembers).values({ teamId: account.teamId, userId: user.id });
  }
  return user;
}

export async function findRole(db: Database, roleId: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new NotFoundError('Role not found');
  return role;
}

export async function findRoleByKey(db: Database, key: string) {
  const [role] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
  if (!role) throw new Error(`The ${key} role is missing; run the changelog`);
  return role;
}

/** Granting the Org admin role, by invitation or by edit, takes an org admin. */
export async function assertMayAssignRole(
  ctx: RequestContext,
  role: { key: string },
): Promise<void> {
  if (role.key === ORG_ADMIN_ROLE_KEY && !(await ctx.authz.isOrgAdmin(ctx.actor))) {
    throw new ForbiddenError('Only org admins can make someone an org admin');
  }
}
