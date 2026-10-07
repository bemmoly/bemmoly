import {
  NotFoundError,
  ValidationError,
  type CreateModuleGrantInput,
  type ListModuleGrantsQuery,
  type ModuleGrant,
} from '@bemmoly/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  moduleGrants,
  roles,
  teams,
  users,
  type ModuleGrantRow,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { ModuleCatalog } from './catalog.ts';
import type { RequestContext } from './context.ts';
import { bumpPrivilegeVersion, type PrivilegeScope } from './privileges.ts';

/** Module access is edited on the People screen, gated like the rest of it. */
const MANAGE = 'workspace.roles.manage' as const;

function presentGrant(row: ModuleGrantRow): ModuleGrant {
  return {
    id: row.id,
    moduleId: row.moduleId,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    grantedBy: row.grantedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listModuleGrants(
  db: Database,
  ctx: RequestContext,
  query: ListModuleGrantsQuery,
): Promise<ModuleGrant[]> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const rows = await db
    .select()
    .from(moduleGrants)
    .where(query.moduleId ? eq(moduleGrants.moduleId, query.moduleId) : undefined)
    .orderBy(asc(moduleGrants.id));
  return rows.map(presentGrant);
}

export async function getModuleGrant(db: Database, ctx: RequestContext, id: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const [row] = await db.select().from(moduleGrants).where(eq(moduleGrants.id, id));
  if (!row) throw new NotFoundError('Module grant not found');
  return presentGrant(row);
}

const SUBJECT_TABLES = { team: teams, role: roles, user: users } as const;

async function assertSubjectExists(db: Database, input: CreateModuleGrantInput): Promise<void> {
  if (input.subjectKind === 'everyone' || !input.subjectId) return;
  const table = SUBJECT_TABLES[input.subjectKind];
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, input.subjectId))
    .limit(1);
  if (!row) {
    throw new ValidationError(`No ${input.subjectKind} has id ${input.subjectId}`, {
      details: { subjectId: input.subjectId },
    });
  }
}

function scopeOf(grant: { subjectKind: string; subjectId: string | null }): PrivilegeScope | null {
  if (grant.subjectKind === 'user' && grant.subjectId) return { userIds: [grant.subjectId] };
  if (grant.subjectKind === 'role' && grant.subjectId) return { roleId: grant.subjectId };
  if (grant.subjectKind === 'team' && grant.subjectId) return { teamId: grant.subjectId };
  return null;
}

/** Idempotent: granting what already exists returns the existing grant. */
export async function createModuleGrant(
  db: Database,
  modules: ModuleCatalog,
  ctx: RequestContext,
  input: CreateModuleGrantInput,
): Promise<ModuleGrant> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  if (!modules.ids().includes(input.moduleId)) {
    throw new NotFoundError(`The ${input.moduleId} module is not enabled`, {
      code: 'module_not_enabled',
    });
  }
  await assertSubjectExists(db, input);
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(moduleGrants)
      .values({
        moduleId: input.moduleId,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId ?? null,
        grantedBy: ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? null),
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(moduleGrants)
        .where(
          and(
            eq(moduleGrants.moduleId, input.moduleId),
            eq(moduleGrants.subjectKind, input.subjectKind),
            input.subjectId
              ? eq(moduleGrants.subjectId, input.subjectId)
              : isNull(moduleGrants.subjectId),
          ),
        );
      if (!existing) throw new Error('Module grant conflict without an existing row');
      return presentGrant(existing);
    }
    const grant = presentGrant(inserted);
    const scope = scopeOf(inserted);
    if (scope) await bumpPrivilegeVersion(tx, scope);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'module_grant.created',
      target: { kind: 'module_grant', id: grant.id },
      after: grant,
      meta: ctx,
    });
    return grant;
  });
}

export async function deleteModuleGrant(db: Database, ctx: RequestContext, id: string) {
  const before = await getModuleGrant(db, ctx, id);
  await db.transaction(async (tx) => {
    await tx.delete(moduleGrants).where(eq(moduleGrants.id, id));
    const scope = scopeOf(before);
    if (scope) await bumpPrivilegeVersion(tx, scope);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'module_grant.deleted',
      target: { kind: 'module_grant', id },
      before,
      meta: ctx,
    });
  });
}
