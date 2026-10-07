import {
  ConflictError,
  NotFoundError,
  type AcceptInvitationInput,
  type CreateInvitationsInput,
  type Invitation,
  type InvitationPreview,
  type User,
} from '@bemmoly/shared';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { invitations, roles, teams, users } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { assertMayAssignRole, createAccount, findRole } from './accounts.ts';
import { appLink, nowOf, type IdentityDependencies } from './deps.ts';
import { INVITATION_CREATED, INVITATION_TTL_MS, type InvitationCreatedPayload } from './events.ts';
import { loadUser, presentInvitation } from './presenters.ts';
import { generateSecret, hashSecret } from './secrets.ts';
import { createSession, type ClientInfo, type IssuedSession } from './sessions.ts';

const MANAGE = 'workspace.roles.manage' as const;
const pending = and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt));

async function findTeam(db: Database, teamId: string | undefined) {
  if (!teamId) return null;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

/**
 * Invites each address with one role and optional team. An address that
 * already has an account fails the whole batch; a pending invitation to the
 * same address is replaced, which is how "resend" works.
 */
export async function createInvitations(
  deps: IdentityDependencies,
  ctx: RequestContext,
  input: CreateInvitationsInput,
): Promise<Invitation[]> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const role = await findRole(deps.db, input.roleId);
  await assertMayAssignRole(ctx, role);
  const team = await findTeam(deps.db, input.teamId);
  const emails = [...new Set(input.emails)];
  const existing = await deps.db
    .select({ email: users.email })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, emails));
  if (existing.length > 0) {
    throw new ConflictError('Some of these people already have accounts', {
      details: { emails: existing.map((row) => row.email.toLowerCase()) },
    });
  }
  const now = nowOf(deps);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const inviterId = ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? null);
  const issued = await deps.db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(pending, inArray(sql`lower(${invitations.email})`, emails)));
    const created: { row: typeof invitations.$inferSelect; token: string }[] = [];
    for (const email of emails) {
      const token = generateSecret();
      const [row] = await tx
        .insert(invitations)
        .values({
          email,
          roleId: role.id,
          teamId: team?.id ?? null,
          tokenHash: hashSecret(token),
          invitedBy: inviterId,
          expiresAt,
        })
        .returning();
      if (!row) throw new Error('Invitation insert returned no row');
      created.push({ row, token });
      await recordAudit(tx, {
        actor: ctx.actor,
        action: 'invitation.created',
        target: { kind: 'invitation', id: row.id },
        after: presentInvitation(row),
        meta: ctx,
      });
    }
    return created;
  });
  const [inviter] = inviterId
    ? await deps.db.select().from(users).where(eq(users.id, inviterId)).limit(1)
    : [];
  const workspaceName = await deps.settings.get('workspace.name');
  for (const { row, token } of issued) {
    const payload: InvitationCreatedPayload = {
      invitationId: row.id,
      email: row.email,
      roleId: role.id,
      roleName: role.name,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      invitedBy: inviter ? { id: inviter.id, name: inviter.name, email: inviter.email } : null,
      workspaceName,
      acceptUrl: appLink(deps.publicUrl, `/accept-invitation#token=${token}`),
      expiresAt: row.expiresAt.toISOString(),
    };
    await deps.events.publish({
      kind: INVITATION_CREATED,
      occurredAt: now,
      actor: ctx.actor,
      entity: { kind: 'invitation', id: row.id },
      payload,
    });
  }
  return issued.map(({ row }) => presentInvitation(row));
}

/** Pending invitations, newest first, including expired ones the admin may resend. */
export async function listInvitations(db: Database, ctx: RequestContext): Promise<Invitation[]> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const rows = await db.select().from(invitations).where(pending).orderBy(desc(invitations.id));
  return rows.map(presentInvitation);
}

export async function revokeInvitation(db: Database, ctx: RequestContext, id: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(invitations)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invitations.id, id), pending))
      .returning();
    if (!row) throw new NotFoundError('Invitation not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'invitation.revoked',
      target: { kind: 'invitation', id },
      after: presentInvitation(row),
      meta: ctx,
    });
  });
}

const INVALID = 'This invitation is invalid or has expired';

function validByToken(token: string, now: Date) {
  return and(eq(invitations.tokenHash, hashSecret(token)), pending, gt(invitations.expiresAt, now));
}

/** What the accept page shows. Anonymous: the token is the credential. */
export async function previewInvitation(
  deps: Pick<IdentityDependencies, 'db' | 'settings' | 'now'>,
  token: string,
): Promise<InvitationPreview> {
  const [row] = await deps.db
    .select({ invitation: invitations, roleName: roles.name, teamName: teams.name })
    .from(invitations)
    .innerJoin(roles, eq(roles.id, invitations.roleId))
    .leftJoin(teams, eq(teams.id, invitations.teamId))
    .where(validByToken(token, nowOf(deps)))
    .limit(1);
  if (!row) throw new NotFoundError(INVALID);
  return {
    email: row.invitation.email,
    workspaceName: await deps.settings.get('workspace.name'),
    roleName: row.roleName,
    teamName: row.teamName ?? null,
    expiresAt: row.invitation.expiresAt.toISOString(),
  };
}

/** Creates the account from the invitation and signs the person in. */
export async function acceptInvitation(
  deps: Pick<IdentityDependencies, 'db' | 'now'>,
  token: string,
  input: AcceptInvitationInput,
  client: ClientInfo & RequestMeta,
): Promise<{ user: User; session: IssuedSession }> {
  const now = nowOf(deps);
  const { session, userId } = await deps.db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(validByToken(token, now))
      .for('update')
      .limit(1);
    if (!invitation) throw new NotFoundError(INVALID);
    const user = await createAccount(tx, {
      email: invitation.email,
      name: input.name,
      password: input.password,
      roleId: invitation.roleId,
      teamId: invitation.teamId,
    });
    await tx
      .update(invitations)
      .set({ acceptedAt: now, acceptedUserId: user.id, updatedAt: now })
      .where(eq(invitations.id, invitation.id));
    const actor = { kind: 'user', id: user.id } as const;
    await recordAudit(tx, {
      actor,
      action: 'invitation.accepted',
      target: { kind: 'invitation', id: invitation.id },
      after: { userId: user.id },
      meta: client,
    });
    await recordAudit(tx, {
      actor,
      action: 'user.created',
      target: { kind: 'user', id: user.id },
      after: { email: user.email, name: user.name, roleId: user.roleId, via: 'invitation' },
      meta: client,
    });
    const issued = await createSession(tx, {
      userId: user.id,
      privilegeVersion: user.privilegeVersion,
      client,
      now,
    });
    return { session: issued, userId: user.id };
  });
  const user = await loadUser(deps.db, userId);
  if (!user) throw new Error('The account created from the invitation was not found');
  return { user, session };
}
