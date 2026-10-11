import {
  ConflictError,
  type CreateFirstAdminInput,
  type SetupStatusResponse,
  type User,
} from '@bemmoly/shared';
import { sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { users } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import { ORG_ADMIN_ROLE_KEY } from '../authz/index.ts';
import { createAccount, findRoleByKey } from './accounts.ts';
import { nowOf, type IdentityDependencies } from './deps.ts';
import { loadUser } from './presenters.ts';
import { createSession, type ClientInfo, type IssuedSession } from './sessions.ts';

/** Serialises concurrent setup attempts across replicas. */
const SETUP_LOCK = sql`select pg_advisory_xact_lock(hashtext('bemmoly.setup.first_admin'))`;

async function anyUserExists(db: Database): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  return Boolean(row);
}

/** Anonymous by design: the wizard asks this before anyone can sign in. */
export async function getSetupStatus(
  deps: Pick<IdentityDependencies, 'db' | 'settings'>,
): Promise<SetupStatusResponse> {
  const [initialized, completedAt, workspaceName] = await Promise.all([
    anyUserExists(deps.db),
    deps.settings.get('setup.completedAt'),
    deps.settings.get('workspace.name'),
  ]);
  return { initialized, completedAt, workspaceName: initialized ? workspaceName || null : null };
}

/** True until the first admin exists; the wizard's health checks are anonymous until then. */
export async function isSetupOpen(db: Database): Promise<boolean> {
  return !(await anyUserExists(db));
}

/**
 * Creates the first account, an Org admin flagged break-glass so it keeps
 * password sign-in when SSO is required later, and stores the workspace name
 * and URL. Works exactly once per install.
 */
export async function createFirstAdmin(
  deps: IdentityDependencies,
  input: CreateFirstAdminInput,
  client: ClientInfo & RequestMeta,
): Promise<{ user: User; session: IssuedSession }> {
  const now = nowOf(deps);
  const { userId, session } = await deps.db.transaction(async (tx) => {
    await tx.execute(SETUP_LOCK);
    if (await anyUserExists(tx)) {
      throw new ConflictError('Setup is already complete; sign in instead');
    }
    const role = await findRoleByKey(tx, ORG_ADMIN_ROLE_KEY);
    const admin = await createAccount(tx, {
      email: input.email,
      name: input.name,
      password: input.password,
      roleId: role.id,
      isBreakGlass: true,
    });
    const actor: Actor = { kind: 'user', id: admin.id };
    await recordAudit(tx, {
      actor,
      action: 'setup.first_admin_created',
      target: { kind: 'user', id: admin.id },
      after: {
        email: admin.email,
        name: admin.name,
        roleId: role.id,
        isBreakGlass: true,
        workspaceName: input.workspaceName,
        workspaceUrl: input.workspaceUrl,
      },
      meta: client,
    });
    const issued = await createSession(tx, {
      userId: admin.id,
      privilegeVersion: admin.privilegeVersion,
      client,
      now,
    });
    return { userId: admin.id, session: issued };
  });
  const actor: Actor = { kind: 'user', id: userId };
  await deps.settings.set('workspace.name', input.workspaceName, actor);
  await deps.settings.set('workspace.url', input.workspaceUrl, actor);
  const user = await loadUser(deps.db, userId);
  if (!user) throw new Error('The first admin was not found after setup');
  return { user, session };
}
