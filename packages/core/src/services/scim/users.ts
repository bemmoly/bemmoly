import {
  ConflictError,
  DEFAULT_ROLE_KEY,
  NotFoundError,
  type ScimListQuery,
  type ScimPatch,
  type ScimUserInput,
} from '@bemmoly/shared';
import { and, asc, count, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  apiTokens,
  roles,
  teamMembers,
  teams,
  users,
  type UserRow,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { bumpPrivilegeVersion, countActiveOrgAdmins, ORG_ADMIN_ROLE_KEY } from '../authz/index.ts';
import { revokeUserSessions } from '../identity/index.ts';
import { parseScimFilter } from './filter.ts';
import { presentScimUser, scimList, type ScimList, type ScimUser } from './presenters.ts';
import {
  assertScimId,
  externalIdsOf,
  idsByExternalId,
  linkResource,
  unlinkResource,
  type ScimContext,
} from './resources.ts';
import { changesFromPatch, changesFromResource, type UserChanges } from './user-changes.ts';

const FILTERABLE = ['userName', 'externalId', 'emails.value'] as const;

async function present(
  db: Database,
  rows: readonly UserRow[],
  baseUrl: string,
): Promise<ScimUser[]> {
  const ids = rows.map((row) => row.id);
  const externalIds = await externalIdsOf(db, 'user', ids);
  const memberships = ids.length
    ? await db
        .select({ userId: teamMembers.userId, id: teams.id, name: teams.name })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(inArray(teamMembers.userId, ids))
    : [];
  return rows.map((row) =>
    presentScimUser(
      row,
      externalIds.get(row.id) ?? null,
      memberships.filter((membership) => membership.userId === row.id),
      baseUrl,
    ),
  );
}

async function findUser(db: Database, id: string): Promise<UserRow> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, assertScimId(id, 'User')));
  if (!row) throw new NotFoundError(`User ${id} not found`);
  return row;
}

export async function getScimUser(ctx: ScimContext, id: string): Promise<ScimUser> {
  const [user] = await present(ctx.db, [await findUser(ctx.db, id)], ctx.baseUrl);
  return user!;
}

export async function listScimUsers(
  ctx: ScimContext,
  query: ScimListQuery,
): Promise<ScimList<ScimUser>> {
  const filter = parseScimFilter(query.filter, FILTERABLE);
  let where: SQL | undefined;
  if (filter?.attribute === 'externalId') {
    const ids = await idsByExternalId(ctx.db, 'user', filter.value);
    if (ids.length === 0) return scimList([], 0, query.startIndex);
    where = inArray(users.id, ids);
  } else if (filter) {
    where = eq(sql`lower(${users.email})`, filter.value.toLowerCase());
  }
  const [total] = await ctx.db.select({ value: count() }).from(users).where(where);
  const rows = await ctx.db
    .select()
    .from(users)
    .where(where)
    .orderBy(asc(users.createdAt))
    .offset(query.startIndex - 1)
    .limit(query.count);
  return scimList(await present(ctx.db, rows, ctx.baseUrl), total?.value ?? 0, query.startIndex);
}

async function assertEmailFree(db: Database, email: string, exceptId?: string) {
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(sql`lower(${users.email})`, email), exceptId ? ne(users.id, exceptId) : undefined),
    )
    .limit(1);
  if (clash) {
    throw new ConflictError(`Someone already has an account with ${email}`, {
      details: { scimType: 'uniqueness' },
    });
  }
}

/** Deactivation signs the person out everywhere and disables their tokens; data stays. */
async function setActive(db: Database, user: UserRow, active: boolean): Promise<void> {
  const now = new Date();
  if (!active) {
    const [role] = await db.select({ key: roles.key }).from(roles).where(eq(roles.id, user.roleId));
    if (
      role?.key === ORG_ADMIN_ROLE_KEY &&
      user.status === 'active' &&
      (await countActiveOrgAdmins(db)) <= 1
    ) {
      throw new ConflictError('This is the last active org admin; it cannot be deactivated');
    }
    await db
      .update(users)
      .set({ status: 'deactivated', deactivatedAt: now, updatedAt: now })
      .where(eq(users.id, user.id));
    await revokeUserSessions(db, user.id);
    await db
      .update(apiTokens)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)));
    await bumpPrivilegeVersion(db, { userIds: [user.id] });
  } else {
    await db
      .update(users)
      .set({ status: 'active', deactivatedAt: null, updatedAt: now })
      .where(eq(users.id, user.id));
  }
}

async function applyChanges(ctx: ScimContext, user: UserRow, changes: UserChanges): Promise<void> {
  const { db } = ctx;
  if (changes.email && changes.email !== user.email.toLowerCase())
    await assertEmailFree(db, changes.email, user.id);
  const columns = {
    ...(changes.email && changes.email !== user.email.toLowerCase()
      ? { email: changes.email }
      : {}),
    ...(changes.name && changes.name !== user.name ? { name: changes.name } : {}),
  };
  if (Object.keys(columns).length > 0) {
    await db
      .update(users)
      .set({ ...columns, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }
  const activeChanges =
    changes.active !== undefined && changes.active !== (user.status === 'active');
  if (activeChanges) await setActive(db, user, changes.active!);
  await linkResource(db, 'user', user.id, changes.externalId);
  if (Object.keys(columns).length > 0 || activeChanges) {
    await recordAudit(db, {
      actor: ctx.actor,
      action: activeChanges
        ? changes.active
          ? 'user.reactivated'
          : 'user.deactivated'
        : 'user.updated',
      target: { kind: 'user', id: user.id },
      before: { email: user.email, name: user.name, status: user.status },
      after: {
        ...columns,
        ...(activeChanges ? { status: changes.active ? 'active' : 'deactivated' } : {}),
        source: 'scim',
      },
      meta: ctx.meta,
    });
  }
}

export async function createScimUser(ctx: ScimContext, input: ScimUserInput): Promise<ScimUser> {
  const changes = changesFromResource(input);
  const id = await ctx.db.transaction(async (tx) => {
    await assertEmailFree(tx, changes.email);
    const [role] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, DEFAULT_ROLE_KEY));
    if (!role) throw new Error(`The ${DEFAULT_ROLE_KEY} role is missing; run the changelog`);
    const [user] = await tx
      .insert(users)
      .values({
        email: changes.email,
        name: changes.name ?? changes.email.slice(0, changes.email.indexOf('@')),
        roleId: role.id,
        status: changes.active === false ? 'deactivated' : 'active',
        ...(changes.active === false ? { deactivatedAt: new Date() } : {}),
      })
      .returning();
    if (!user) throw new Error('User insert returned no row');
    await linkResource(tx, 'user', user.id, changes.externalId);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'user.provisioned',
      target: { kind: 'user', id: user.id },
      after: { email: user.email, name: user.name, status: user.status, source: 'scim' },
      meta: ctx.meta,
    });
    return user.id;
  });
  return getScimUser(ctx, id);
}

export async function replaceScimUser(ctx: ScimContext, id: string, input: ScimUserInput) {
  await ctx.db.transaction(async (tx) => {
    await applyChanges({ ...ctx, db: tx }, await findUser(tx, id), changesFromResource(input));
  });
  return getScimUser(ctx, id);
}

export async function patchScimUser(ctx: ScimContext, id: string, patch: ScimPatch) {
  await ctx.db.transaction(async (tx) => {
    await applyChanges(
      { ...ctx, db: tx },
      await findUser(tx, id),
      changesFromPatch(patch.Operations),
    );
  });
  return getScimUser(ctx, id);
}

/** DELETE deactivates and stops provisioning; the person's work stays attributed to them. */
export async function deleteScimUser(ctx: ScimContext, id: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const user = await findUser(tx, id);
    await applyChanges({ ...ctx, db: tx }, user, { active: false });
    await unlinkResource(tx, 'user', user.id);
  });
}
