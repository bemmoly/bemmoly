import {
  ConflictError,
  NOTIFICATION_EVENT_KINDS,
  NotFoundError,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { authProviders, roles, users } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { ORG_ADMIN_ROLE_KEY, type RequestContext } from '../authz/index.ts';
import {
  assertBreakGlassRemains,
  inSharedTransaction,
  orgAdminsForPolicy,
} from '../identity/index.ts';
import { nowOf, type SsoDependencies } from './deps.ts';

const CONFIGURE = 'workspace.sso.configure' as const;
export const BREAK_GLASS_NOTIFICATION_KIND = 'break_glass_changed';
const SETTINGS_PATH = '/settings/authentication';

/**
 * Serialises every change to who keeps a password: two admins unflagging the last two
 * break-glass admins at once, or one requiring SSO while another unflags, queue here.
 */
export async function lockSignInPolicy(tx: Database): Promise<void> {
  await tx
    .select({ id: authProviders.id })
    .from(authProviders)
    .where(eq(authProviders.kind, 'password'))
    .for('update');
}

async function personOf(tx: Database, userId: string) {
  const [row] = await tx
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      isBreakGlass: users.isBreakGlass,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** Every other active org admin hears about it, in the inbox and by email at once. */
async function otherAdmins(tx: Database, actorUserId: string | undefined) {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.status, 'active'),
        eq(roles.key, ORG_ADMIN_ROLE_KEY),
        ...(actorUserId ? [ne(users.id, actorUserId)] : []),
      ),
    );
  return rows.map((row) => row.id);
}

async function actorName(tx: Database, actorUserId: string | undefined) {
  if (!actorUserId) return undefined;
  const [row] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorUserId));
  return row?.name;
}

function notice(
  person: { id: string; name: string },
  breakGlass: boolean,
  recipientIds: string[],
  actor: { id?: string; name?: string },
  at: Date,
): NotificationRequestedPayload {
  return {
    kind: BREAK_GLASS_NOTIFICATION_KIND,
    recipientIds,
    ...(actor.id ? { actorId: actor.id } : {}),
    ...(actor.name ? { actorName: actor.name } : {}),
    target: { kind: 'workspace', id: 'sign-in', label: 'Sign-in and SSO', url: SETTINGS_PATH },
    body: breakGlass
      ? `${person.name} is now a break-glass admin and keeps password sign-in while single sign-on is required.`
      : `${person.name} is no longer a break-glass admin and signs in with single sign-on like everyone else.`,
    dedupeKey: `break-glass:${person.id}:${breakGlass ? 'on' : 'off'}:${at.toISOString()}`,
    data: { personId: person.id, personName: person.name, breakGlass },
  };
}

/**
 * Marks or unmarks an org admin as break-glass: they keep password sign-in while single
 * sign-on is required. Only an active org admin with a password can be one; while SSO is
 * required the last one cannot be unmarked. Each change is audited and every other org admin
 * is told, in the same transaction.
 */
export async function setBreakGlass(
  deps: SsoDependencies,
  ctx: RequestContext,
  userId: string,
  breakGlass: boolean,
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const actorUserId = ctx.actor.kind === 'user' ? ctx.actor.id : ctx.actor.userId;
  await inSharedTransaction(deps.sql, async (tx: Database, executor: SqlExecutor) => {
    await lockSignInPolicy(tx);
    const person = await personOf(tx, userId);
    if (!person) throw new NotFoundError('Person not found');
    if (person.isBreakGlass === breakGlass) return;
    if (breakGlass) {
      if (person.status !== 'active' || person.roleKey !== ORG_ADMIN_ROLE_KEY) {
        throw new ConflictError(`Only active org admins can be break-glass admins`);
      }
      const admin = (await orgAdminsForPolicy(tx)).find((entry) => entry.id === userId);
      if (!admin?.hasPassword) {
        throw new ConflictError(
          `${person.name} signs in only with single sign-on, so there is no password to fall back on`,
          { details: { reason: 'no_password' } },
        );
      }
    } else {
      await assertBreakGlassRemains(tx, person);
    }
    await tx
      .update(users)
      .set({ isBreakGlass: breakGlass, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: breakGlass ? 'sso.break_glass_added' : 'sso.break_glass_removed',
      target: { kind: 'user', id: userId },
      before: { isBreakGlass: person.isBreakGlass },
      after: { isBreakGlass: breakGlass, name: person.name, email: person.email },
      meta: ctx,
    });
    const recipients = await otherAdmins(tx, actorUserId);
    if (recipients.length === 0) return;
    const name = await actorName(tx, actorUserId);
    await deps.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
      occurredAt: nowOf(deps),
      actor: ctx.actor,
      payload: notice(
        person,
        breakGlass,
        recipients,
        { ...(actorUserId ? { id: actorUserId } : {}), ...(name ? { name } : {}) },
        nowOf(deps),
      ),
      transaction: executor,
    });
  });
}
