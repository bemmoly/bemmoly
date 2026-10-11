import { DEFAULT_ROLE_KEY } from '@bemmoly/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authIdentities, roles, users, type UserRow } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import type { LoadedProvider } from './config.ts';
import { syncMappings, mappedRoleId } from './mapping.ts';
import { SsoFailure, type ExternalIdentity } from './protocol.ts';

export interface ResolvedPerson {
  user: UserRow;
  created: boolean;
  linked: boolean;
}

const domainOf = (email: string) => email.slice(email.lastIndexOf('@') + 1).toLowerCase();

/** The checks that hold before anyone is looked up: an address, from an allowed domain. */
export function checkIdentity(provider: LoadedProvider, identity: ExternalIdentity): string {
  if (!identity.email || !identity.email.includes('@')) {
    throw new SsoFailure('email_missing', 'The identity provider sent no email address');
  }
  const allowed = provider.allowedDomains;
  if (allowed.length > 0 && !allowed.includes(domainOf(identity.email))) {
    throw new SsoFailure(
      'domain_not_allowed',
      `${domainOf(identity.email)} is not on this provider's list of allowed domains`,
    );
  }
  return identity.email;
}

async function defaultRoleId(db: Database, provider: LoadedProvider): Promise<string> {
  if (provider.row.defaultRoleId) return provider.row.defaultRoleId;
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, DEFAULT_ROLE_KEY));
  if (!role) throw new Error(`The ${DEFAULT_ROLE_KEY} role is missing; run the changelog`);
  return role.id;
}

async function findLinked(db: Database, providerId: string, subject: string) {
  const [row] = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.providerId, providerId), eq(authIdentities.subject, subject)))
    .limit(1);
  return row?.user ?? null;
}

async function findByEmail(db: Database, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  return row ?? null;
}

async function link(
  db: Database,
  provider: LoadedProvider,
  identity: ExternalIdentity,
  user: UserRow,
) {
  await db.insert(authIdentities).values({
    userId: user.id,
    providerId: provider.row.id,
    subject: identity.subject,
  });
}

async function create(
  db: Database,
  provider: LoadedProvider,
  identity: ExternalIdentity,
  email: string,
): Promise<UserRow> {
  const roleId = mappedRoleId(provider, identity.groups) ?? (await defaultRoleId(db, provider));
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: identity.name ?? email.slice(0, email.indexOf('@')),
      roleId,
      status: 'active',
    })
    .returning();
  if (!user) throw new Error('User insert returned no row');
  await link(db, provider, identity, user);
  return user;
}

/**
 * Finds or creates the person behind a verified identity, inside the caller's transaction:
 * an existing link first; otherwise an account with the same, verified, address is linked;
 * otherwise, when the provider provisions, a new account is created with the mapped or
 * default role. Then roles and teams follow the person's groups.
 */
export async function resolvePerson(
  db: Database,
  provider: LoadedProvider,
  identity: ExternalIdentity,
  meta: RequestMeta,
): Promise<ResolvedPerson> {
  const email = checkIdentity(provider, identity);
  let user = await findLinked(db, provider.row.id, identity.subject);
  let created = false;
  let linked = false;
  if (!user) {
    const existing = await findByEmail(db, email);
    if (existing) {
      if (!identity.emailVerified) {
        throw new SsoFailure('email_unverified', `The identity provider has not verified ${email}`);
      }
      await link(db, provider, identity, existing);
      user = existing;
      linked = true;
    } else if (provider.row.autoProvision) {
      if (!identity.emailVerified) {
        throw new SsoFailure('email_unverified', `The identity provider has not verified ${email}`);
      }
      user = await create(db, provider, identity, email);
      created = true;
    } else {
      throw new SsoFailure('not_provisioned', `${email} has no account and sign-up is off`);
    }
  }
  if (user.status === 'deactivated') {
    throw new SsoFailure('deactivated', `The account for ${email} is deactivated`);
  }
  if (user.status === 'invited') {
    // Signing in through the identity provider is as good as accepting the invitation.
    const [activated] = await db
      .update(users)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    if (activated) user = activated;
  }
  if (created || linked) {
    await recordAudit(db, {
      actor: { kind: 'user', id: user.id },
      action: created ? 'user.provisioned' : 'sso.identity_linked',
      target: { kind: 'user', id: user.id },
      after: { providerId: provider.row.id, email, roleId: user.roleId, groups: identity.groups },
      meta,
    });
  }
  await syncMappings(db, provider, user, identity.groups, { meta, isNew: created });
  return { user, created, linked };
}
