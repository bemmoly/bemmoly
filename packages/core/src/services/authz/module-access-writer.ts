import { ValidationError, type ModuleAccessChoice } from '@bemmoly/shared';
import { inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { ModuleAccessWriter } from '../../contracts/module-access.ts';
import { moduleGrants, teams } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { bumpPrivilegeVersion } from './privileges.ts';

function teamIdsOf(access: ModuleAccessChoice): string[] {
  return access.mode === 'teams' ? [...new Set(access.teamIds ?? [])] : [];
}

async function assertTeamsExist(db: Database, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.id, [...ids]));
  const known = new Set(found.map((row) => row.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new ValidationError('Some of the chosen teams do not exist', {
      details: { teamIds: missing },
    });
  }
}

const grantorOf = (actor: Actor) => (actor.kind === 'user' ? actor.id : (actor.userId ?? null));

/**
 * The access an admin chose when enabling a module. `none` grants nothing, so
 * only org admins see the module; `everyone` and `teams` add those grants.
 * Grants the module already holds are kept, so re-enabling never undoes what
 * an admin set up under Users › Module access.
 */
export function createModuleAccessWriter(db: Database): ModuleAccessWriter {
  return {
    check: (access) => assertTeamsExist(db, teamIdsOf(access)),
    async apply(moduleId, access, actor) {
      if (access.mode === 'none') return;
      const teamIds = teamIdsOf(access);
      await assertTeamsExist(db, teamIds);
      const subjects =
        access.mode === 'everyone'
          ? [{ subjectKind: 'everyone' as const, subjectId: null }]
          : teamIds.map((id) => ({ subjectKind: 'team' as const, subjectId: id }));
      await db.transaction(async (tx) => {
        for (const subject of subjects) {
          const [grant] = await tx
            .insert(moduleGrants)
            .values({ moduleId, ...subject, grantedBy: grantorOf(actor) })
            .onConflictDoNothing()
            .returning();
          if (!grant) continue;
          if (subject.subjectId) await bumpPrivilegeVersion(tx, { teamId: subject.subjectId });
          await recordAudit(tx, {
            actor,
            action: 'module_grant.created',
            target: { kind: 'module_grant', id: grant.id },
            after: { moduleId, ...subject, reason: 'module_enabled' },
          });
        }
      });
    },
  };
}
