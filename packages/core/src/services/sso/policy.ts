import {
  ConflictError,
  ssoTestResultSchema,
  type SsoPolicy,
  type SsoSignInOptionsResponse,
  type UpdateSsoPolicyInput,
} from '@bemmoly/shared';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authProviders } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { breakGlassAdmins, isPasswordSignInOff, orgAdminsForPolicy } from '../identity/index.ts';
import { lockSignInPolicy } from './break-glass.ts';
import { isSsoProtocol } from './protocol.ts';

export { isPasswordSignInOff };

const CONFIGURE = 'workspace.sso.configure' as const;

export async function getSsoPolicy(db: Database, ctx: RequestContext): Promise<SsoPolicy> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  return {
    requireSso: await isPasswordSignInOff(db),
    breakGlassAdmins: await breakGlassAdmins(db),
    admins: await orgAdminsForPolicy(db),
  };
}

async function assertSafeToRequire(db: Database): Promise<void> {
  const providers = await db
    .select({ lastTest: authProviders.lastTest })
    .from(authProviders)
    .where(and(ne(authProviders.kind, 'password'), eq(authProviders.enabled, true)));
  const tested = providers.some(({ lastTest }) => ssoTestResultSchema.safeParse(lastTest).data?.ok);
  if (!tested) {
    throw new ConflictError(
      'Run a successful test sign-in with an enabled provider before requiring single sign-on',
    );
  }
  if ((await breakGlassAdmins(db)).length === 0) {
    throw new ConflictError(
      'Requiring single sign-on needs a break-glass admin who can still sign in with a password',
    );
  }
}

export async function updateSsoPolicy(
  db: Database,
  ctx: RequestContext,
  input: UpdateSsoPolicyInput,
): Promise<SsoPolicy> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  await db.transaction(async (tx) => {
    await lockSignInPolicy(tx);
    const before = await isPasswordSignInOff(tx);
    if (before === input.requireSso) return;
    if (input.requireSso) await assertSafeToRequire(tx);
    await tx
      .update(authProviders)
      .set({ enabled: !input.requireSso, updatedAt: new Date() })
      .where(eq(authProviders.kind, 'password'));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'sso.policy_updated',
      target: { kind: 'workspace' },
      before: { requireSso: before },
      after: { requireSso: input.requireSso },
      meta: ctx,
    });
  });
  return getSsoPolicy(db, ctx);
}

/** Anonymous by design: what the sign-in page shows, without any configuration. */
export async function listSignInOptions(db: Database): Promise<SsoSignInOptionsResponse> {
  const rows = await db
    .select({
      id: authProviders.id,
      kind: authProviders.kind,
      displayName: authProviders.displayName,
      preset: authProviders.preset,
    })
    .from(authProviders)
    .where(and(ne(authProviders.kind, 'password'), eq(authProviders.enabled, true)))
    .orderBy(asc(authProviders.createdAt));
  return {
    items: rows.flatMap((row) =>
      isSsoProtocol(row.kind)
        ? [{ id: row.id, displayName: row.displayName, protocol: row.kind, preset: row.preset }]
        : [],
    ),
    requireSso: await isPasswordSignInOff(db),
  };
}
