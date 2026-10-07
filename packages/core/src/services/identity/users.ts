import {
  ConflictError,
  NotFoundError,
  type ListUsersQuery,
  type MeResponse,
  type UpdateUserInput,
  type User,
  type UsersPage,
} from '@bemmoly/shared';
import { and, asc, eq, gt, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { apiTokens, users } from '../../models/identity/index.ts';
import { decodeCursor, toPage } from '../../utils/keyset.ts';
import { recordAudit } from '../audit/index.ts';
import { readWorkspaceLook } from '../settings/index.ts';
import type { IdentityDependencies } from './deps.ts';
import {
  bumpPrivilegeVersion,
  countActiveOrgAdmins,
  ORG_ADMIN_ROLE_KEY,
  type RequestContext,
} from '../authz/index.ts';
import { assertMayAssignRole, findRole } from './accounts.ts';
import { loadUser, presentUsers } from './presenters.ts';
import { revokeUserSessions } from './sessions.ts';

const MANAGE = 'workspace.roles.manage' as const;

function selfId(ctx: RequestContext): string {
  return ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? '');
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (match) => `\\${match}`);

/** Everyone signed in may list people: pickers, mentions and ⌘K need them. */
export async function listUsers(db: Database, query: ListUsersQuery): Promise<UsersPage> {
  const where: (SQL | undefined)[] = [query.status ? eq(users.status, query.status) : undefined];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    where.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
  }
  const cursor = decodeCursor(query.cursor);
  if (cursor) where.push(gt(users.id, cursor));
  const rows = await db
    .select()
    .from(users)
    .where(and(...where))
    .orderBy(asc(users.id))
    .limit(query.limit + 1);
  const page = toPage(rows, query.limit);
  return { items: await presentUsers(db, page.rows), nextCursor: page.nextCursor };
}

export async function getUser(db: Database, userId: string): Promise<User> {
  const user = await loadUser(db, userId);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

async function assertNotLastOrgAdmin(db: Database, user: User, roleKey: string) {
  if (roleKey !== ORG_ADMIN_ROLE_KEY || user.status !== 'active') return;
  if ((await countActiveOrgAdmins(db)) <= 1) {
    throw new ConflictError('This is the last active org admin; make someone else one first');
  }
}

/**
 * People edit their own profile; changing someone else, or anyone's role,
 * takes workspace.roles.manage. A role change rotates that person's sessions.
 */
export async function updateUser(
  db: Database,
  ctx: RequestContext,
  userId: string,
  input: UpdateUserInput,
): Promise<User> {
  const before = await getUser(db, userId);
  const roleChanges = input.roleId !== undefined && input.roleId !== before.roleId;
  if (userId !== selfId(ctx) || roleChanges) {
    await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  }
  if (roleChanges && input.roleId) {
    await assertMayAssignRole(ctx, await findRole(db, input.roleId));
    await assertNotLastOrgAdmin(db, before, (await findRole(db, before.roleId)).key);
  }
  const changes = Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => value !== undefined && value !== before[key as keyof User],
    ),
  ) as UpdateUserInput;
  if (Object.keys(changes).length === 0) return before;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(users.id, userId));
    if (roleChanges) await bumpPrivilegeVersion(tx, { userIds: [userId] });
    await recordAudit(tx, {
      actor: ctx.actor,
      action: roleChanges ? 'user.role_changed' : 'user.updated',
      target: { kind: 'user', id: userId },
      before: Object.fromEntries(
        Object.keys(changes).map((key) => [key, before[key as keyof User]]),
      ),
      after: changes,
      meta: ctx,
    });
  });
  return getUser(db, userId);
}

/** Signs the person out everywhere and disables their tokens; their data stays. */
export async function deactivateUser(db: Database, ctx: RequestContext, userId: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  if (userId === selfId(ctx)) throw new ConflictError('You cannot deactivate yourself');
  const before = await getUser(db, userId);
  if (before.status === 'deactivated') return before;
  await assertNotLastOrgAdmin(db, before, (await findRole(db, before.roleId)).key);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: 'deactivated', deactivatedAt: now, updatedAt: now })
      .where(eq(users.id, userId));
    const sessions = await revokeUserSessions(tx, userId);
    await tx
      .update(apiTokens)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
    await bumpPrivilegeVersion(tx, { userIds: [userId] });
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'user.deactivated',
      target: { kind: 'user', id: userId },
      before: { status: before.status },
      after: { status: 'deactivated', sessionsRevoked: sessions },
      meta: ctx,
    });
  });
  return getUser(db, userId);
}

export async function reactivateUser(db: Database, ctx: RequestContext, userId: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const before = await getUser(db, userId);
  if (before.status === 'active') return before;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: 'active', deactivatedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'user.reactivated',
      target: { kind: 'user', id: userId },
      before: { status: before.status },
      after: { status: 'active' },
      meta: ctx,
    });
  });
  return getUser(db, userId);
}

/** The signed-in person with what they may do and see, for the web shell. */
export async function getMe(
  deps: Pick<IdentityDependencies, 'db' | 'settings'>,
  ctx: RequestContext,
): Promise<MeResponse> {
  const user = await getUser(deps.db, selfId(ctx));
  const [capabilities, modules, workspace] = await Promise.all([
    ctx.authz.workspaceCapabilities(ctx.actor),
    ctx.authz.modulesFor(ctx.actor),
    readWorkspaceLook(deps.settings),
  ]);
  return { user, capabilities: capabilities.sort(), modules: [...modules].sort(), workspace };
}
