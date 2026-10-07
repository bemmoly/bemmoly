import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type CreateTeamInput,
  type Team,
  type TeamMember,
  type UpdateTeamInput,
} from '@bemmoly/shared';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  moduleGrants,
  roles,
  teamMembers,
  teams,
  users,
  type TeamRow,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { bumpPrivilegeVersion, type RequestContext } from '../authz/index.ts';

const MANAGE = 'workspace.roles.manage' as const;

const memberCount = sql<number>`(select count(*)::int from team_members m where m.team_id = ${teams.id})`;

function presentTeam(row: TeamRow, count: number): Team {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    leadUserId: row.leadUserId,
    defaultRoleId: row.defaultRoleId,
    memberCount: count,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTeams(db: Database): Promise<Team[]> {
  const rows = await db.select({ team: teams, memberCount }).from(teams).orderBy(asc(teams.name));
  return rows.map((row) => presentTeam(row.team, row.memberCount));
}

export async function getTeam(db: Database, teamId: string): Promise<Team> {
  const [row] = await db
    .select({ team: teams, memberCount })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (!row) throw new NotFoundError('Team not found');
  return presentTeam(row.team, row.memberCount);
}

async function assertReferences(db: Database, input: UpdateTeamInput, teamId?: string) {
  if (input.name) {
    const clash = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          eq(sql`lower(${teams.name})`, input.name.toLowerCase()),
          teamId ? ne(teams.id, teamId) : undefined,
        ),
      );
    if (clash.length > 0) throw new ConflictError('A team with this name already exists');
  }
  if (input.leadUserId) {
    const [lead] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.leadUserId));
    if (!lead) throw new ValidationError('The team lead was not found');
  }
  if (input.defaultRoleId) {
    const [role] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, input.defaultRoleId));
    if (!role) throw new ValidationError('The default role was not found');
  }
}

export async function createTeam(db: Database, ctx: RequestContext, input: CreateTeamInput) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  await assertReferences(db, input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(teams).values(input).returning();
    if (!row) throw new Error('Team insert returned no row');
    const team = presentTeam(row, 0);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'team.created',
      target: { kind: 'team', id: row.id },
      after: team,
      meta: ctx,
    });
    return team;
  });
}

export async function updateTeam(
  db: Database,
  ctx: RequestContext,
  teamId: string,
  input: UpdateTeamInput,
): Promise<Team> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const before = await getTeam(db, teamId);
  await assertReferences(db, input, teamId);
  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(teams.id, teamId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'team.updated',
      target: { kind: 'team', id: teamId },
      before,
      after: input,
      meta: ctx,
    });
  });
  return getTeam(db, teamId);
}

/** Members lose any module access that came through the team. */
export async function deleteTeam(db: Database, ctx: RequestContext, teamId: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const before = await getTeam(db, teamId);
  await db.transaction(async (tx) => {
    await bumpPrivilegeVersion(tx, { teamId });
    await tx
      .delete(moduleGrants)
      .where(and(eq(moduleGrants.subjectKind, 'team'), eq(moduleGrants.subjectId, teamId)));
    await tx.delete(teams).where(eq(teams.id, teamId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'team.deleted',
      target: { kind: 'team', id: teamId },
      before,
      meta: ctx,
    });
  });
}

export async function listTeamMembers(db: Database, teamId: string): Promise<TeamMember[]> {
  await getTeam(db, teamId);
  const rows = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.id));
  return rows.map((row) => ({
    teamId: row.teamId,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Idempotent: adding someone already on the team changes nothing. */
export async function addTeamMember(
  db: Database,
  ctx: RequestContext,
  teamId: string,
  userId: string,
): Promise<TeamMember> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  await getTeam(db, teamId);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError('User not found');
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(teamMembers)
      .values({ teamId, userId })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      await bumpPrivilegeVersion(tx, { userIds: [userId] });
      await recordAudit(tx, {
        actor: ctx.actor,
        action: 'team.member_added',
        target: { kind: 'team', id: teamId },
        after: { userId },
        meta: ctx,
      });
    }
    const [row] = await tx
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    if (!row) throw new Error('Team membership vanished');
    return { teamId, userId, createdAt: row.createdAt.toISOString() };
  });
}

export async function removeTeamMember(
  db: Database,
  ctx: RequestContext,
  teamId: string,
  userId: string,
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .returning({ id: teamMembers.id });
    if (deleted.length === 0) throw new NotFoundError('This person is not on the team');
    await bumpPrivilegeVersion(tx, { userIds: [userId] });
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'team.member_removed',
      target: { kind: 'team', id: teamId },
      before: { userId },
      meta: ctx,
    });
  });
}
