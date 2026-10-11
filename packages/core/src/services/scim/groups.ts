import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ScimGroupInput,
  type ScimListQuery,
  type ScimPatch,
} from '@bemmoly/shared';
import { and, asc, count, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { teamMembers, teams, users, type TeamRow } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { bumpPrivilegeVersion } from '../authz/index.ts';
import { parseScimFilter } from './filter.ts';
import { membershipChanges, type MembershipChanges } from './group-changes.ts';
import { presentScimGroup, scimList, type ScimGroup, type ScimList } from './presenters.ts';
import {
  assertScimId,
  externalIdsOf,
  idsByExternalId,
  linkResource,
  unlinkResource,
  type ScimContext,
} from './resources.ts';

const FILTERABLE = ['displayName', 'externalId'] as const;

async function present(
  db: Database,
  rows: readonly TeamRow[],
  baseUrl: string,
): Promise<ScimGroup[]> {
  const ids = rows.map((row) => row.id);
  const externalIds = await externalIdsOf(db, 'group', ids);
  const members = ids.length
    ? await db
        .select({ teamId: teamMembers.teamId, id: users.id, name: users.name })
        .from(teamMembers)
        .innerJoin(users, eq(users.id, teamMembers.userId))
        .where(inArray(teamMembers.teamId, ids))
    : [];
  return rows.map((row) =>
    presentScimGroup(
      row,
      externalIds.get(row.id) ?? null,
      members.filter((member) => member.teamId === row.id),
      baseUrl,
    ),
  );
}

async function findTeam(db: Database, id: string): Promise<TeamRow> {
  const [row] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, assertScimId(id, 'Group')));
  if (!row) throw new NotFoundError(`Group ${id} not found`);
  return row;
}

export async function getScimGroup(ctx: ScimContext, id: string): Promise<ScimGroup> {
  const [group] = await present(ctx.db, [await findTeam(ctx.db, id)], ctx.baseUrl);
  return group!;
}

export async function listScimGroups(
  ctx: ScimContext,
  query: ScimListQuery,
): Promise<ScimList<ScimGroup>> {
  const filter = parseScimFilter(query.filter, FILTERABLE);
  let where: SQL | undefined;
  if (filter?.attribute === 'externalId') {
    const ids = await idsByExternalId(ctx.db, 'group', filter.value);
    if (ids.length === 0) return scimList([], 0, query.startIndex);
    where = inArray(teams.id, ids);
  } else if (filter) {
    where = eq(sql`lower(${teams.name})`, filter.value.toLowerCase());
  }
  const [total] = await ctx.db.select({ value: count() }).from(teams).where(where);
  const rows = await ctx.db
    .select()
    .from(teams)
    .where(where)
    .orderBy(asc(teams.createdAt))
    .offset(query.startIndex - 1)
    .limit(query.count);
  return scimList(await present(ctx.db, rows, ctx.baseUrl), total?.value ?? 0, query.startIndex);
}

async function assertUsersExist(db: Database, ids: readonly string[]) {
  if (ids.length === 0) return;
  const valid = ids.map((id) => {
    try {
      return assertScimId(id, 'User');
    } catch {
      throw new ValidationError(`Member ${id} is not a user here`, {
        details: { scimType: 'invalidValue' },
      });
    }
  });
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, valid));
  if (found.length !== new Set(valid).size) {
    throw new ValidationError('A member is not a user here', {
      details: { scimType: 'invalidValue' },
    });
  }
}

async function assertNameFree(db: Database, name: string, exceptId: string) {
  const [clash] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(sql`lower(${teams.name})`, name.toLowerCase()), ne(teams.id, exceptId)));
  if (clash)
    throw new ConflictError(`A team named ${name} already exists`, {
      details: { scimType: 'uniqueness' },
    });
}

/** Membership and name changes, with one audit row per member added or removed. */
async function applyChanges(ctx: ScimContext, team: TeamRow, changes: MembershipChanges) {
  const { db } = ctx;
  if (changes.displayName && changes.displayName !== team.name) {
    await assertNameFree(db, changes.displayName, team.id);
    await db
      .update(teams)
      .set({ name: changes.displayName, updatedAt: new Date() })
      .where(eq(teams.id, team.id));
    await recordAudit(db, {
      actor: ctx.actor,
      action: 'team.updated',
      target: { kind: 'team', id: team.id },
      before: { name: team.name },
      after: { name: changes.displayName, source: 'scim' },
      meta: ctx.meta,
    });
  }
  const current = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));
  const have = new Set(current.map((row) => row.userId));
  const lower = (ids: readonly string[]) => ids.map((id) => id.toLowerCase());
  const target = changes.replace ? new Set(lower(changes.replace)) : new Set(have);
  for (const id of lower(changes.add)) target.add(id);
  for (const id of lower(changes.remove)) target.delete(id);
  const add = [...target].filter((id) => !have.has(id));
  await assertUsersExist(db, add);
  const remove = [...have].filter((id) => !target.has(id));
  if (add.length > 0) {
    await db
      .insert(teamMembers)
      .values(add.map((userId) => ({ teamId: team.id, userId })))
      .onConflictDoNothing();
  }
  if (remove.length > 0) {
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), inArray(teamMembers.userId, remove)));
  }
  for (const [userIds, action] of [
    [add, 'team.member_added'],
    [remove, 'team.member_removed'],
  ] as const) {
    for (const userId of userIds) {
      await recordAudit(db, {
        actor: ctx.actor,
        action,
        target: { kind: 'team', id: team.id },
        after: { userId, source: 'scim' },
        meta: ctx.meta,
      });
    }
  }
  await bumpPrivilegeVersion(db, { userIds: [...add, ...remove] });
  await linkResource(db, 'group', team.id, changes.externalId);
}

/** A group becomes a team; an existing team with the same name is adopted, not duplicated. */
export async function createScimGroup(ctx: ScimContext, input: ScimGroupInput): Promise<ScimGroup> {
  const id = await ctx.db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(teams)
      .where(eq(sql`lower(${teams.name})`, input.displayName.toLowerCase()));
    let team = existing;
    if (!team) {
      [team] = await tx.insert(teams).values({ name: input.displayName }).returning();
      if (!team) throw new Error('Team insert returned no row');
      await recordAudit(tx, {
        actor: ctx.actor,
        action: 'team.created',
        target: { kind: 'team', id: team.id },
        after: { name: team.name, source: 'scim' },
        meta: ctx.meta,
      });
    }
    await applyChanges({ ...ctx, db: tx }, team, {
      replace: (input.members ?? []).map((member) => member.value),
      add: [],
      remove: [],
      ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
    });
    return team.id;
  });
  return getScimGroup(ctx, id);
}

export async function replaceScimGroup(ctx: ScimContext, id: string, input: ScimGroupInput) {
  await ctx.db.transaction(async (tx) => {
    await applyChanges({ ...ctx, db: tx }, await findTeam(tx, id), {
      displayName: input.displayName,
      replace: (input.members ?? []).map((member) => member.value),
      add: [],
      remove: [],
      ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
    });
  });
  return getScimGroup(ctx, id);
}

export async function patchScimGroup(ctx: ScimContext, id: string, patch: ScimPatch) {
  await ctx.db.transaction(async (tx) => {
    await applyChanges(
      { ...ctx, db: tx },
      await findTeam(tx, id),
      membershipChanges(patch.Operations),
    );
  });
  return getScimGroup(ctx, id);
}

/**
 * The identity provider stops managing the group: its members leave the team, but the team
 * stays, since projects and spaces may belong to it and an admin decides whether it goes.
 */
export async function deleteScimGroup(ctx: ScimContext, id: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const team = await findTeam(tx, id);
    await applyChanges({ ...ctx, db: tx }, team, { replace: [], add: [], remove: [] });
    await unlinkResource(tx, 'group', team.id);
  });
}
