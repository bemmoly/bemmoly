import { NotFoundError, type OAuthGrant } from '@bemmoly/shared';
import { and, desc, eq, isNotNull, isNull, lt, notExists } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  oauthAuthorizationCodes,
  oauthClients,
  oauthDeviceCodes,
  oauthGrants,
  oauthTokens,
  type OAuthClientRow,
  type OAuthGrantRow,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { sessionUserId } from './request.ts';
import { accessOf } from './scopes.ts';

function present(grant: OAuthGrantRow, client: OAuthClientRow): OAuthGrant {
  return {
    id: grant.id,
    client: { id: client.clientId, name: client.name, host: new URL(client.clientId).host },
    access: accessOf(grant.scopes),
    modules: grant.modules ?? null,
    resource: grant.resource,
    lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
  };
}

/** Profile › Access tokens › Connected apps: the person's live connections, newest first. */
export async function listMyGrants(db: Database, ctx: RequestContext): Promise<OAuthGrant[]> {
  const userId = sessionUserId(ctx);
  const rows = await db
    .select({ grant: oauthGrants, client: oauthClients })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(and(eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
    .orderBy(desc(oauthGrants.id));
  return rows.map((row) => present(row.grant, row.client));
}

/** Disconnects an app: its tokens stop working at once, refresh included. */
export async function revokeMyGrant(db: Database, ctx: RequestContext, id: string): Promise<void> {
  const userId = sessionUserId(ctx);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(oauthGrants)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(oauthGrants.id, id), eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)),
      )
      .returning();
    if (!row) throw new NotFoundError('Connected app not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'oauth.grant_revoked',
      target: { kind: 'oauth_grant', id },
      before: { resource: row.resource, scopes: row.scopes, modules: row.modules },
      after: { reason: 'person_revoked' },
      meta: ctx,
    });
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Revoked connections and unused clients are kept a while for support, then dropped. */
const KEEP_MS = 30 * DAY_MS;

/** Housekeeping: expired codes (device ones too) and tokens, old revoked connections, clients nobody uses. */
export async function deleteExpiredOAuthState(db: Database, now: Date): Promise<number> {
  const old = new Date(now.getTime() - KEEP_MS);
  const codes = await db
    .delete(oauthAuthorizationCodes)
    .where(lt(oauthAuthorizationCodes.expiresAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: oauthAuthorizationCodes.id });
  const devices = await db
    .delete(oauthDeviceCodes)
    .where(lt(oauthDeviceCodes.expiresAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: oauthDeviceCodes.id });
  const tokens = await db
    .delete(oauthTokens)
    .where(lt(oauthTokens.expiresAt, now))
    .returning({ id: oauthTokens.id });
  const grants = await db
    .delete(oauthGrants)
    .where(and(isNotNull(oauthGrants.revokedAt), lt(oauthGrants.revokedAt, old)))
    .returning({ id: oauthGrants.id });
  const clients = await db
    .delete(oauthClients)
    .where(
      and(
        lt(oauthClients.fetchedAt, old),
        notExists(
          db
            .select({ id: oauthGrants.id })
            .from(oauthGrants)
            .where(eq(oauthGrants.clientId, oauthClients.id)),
        ),
        notExists(
          db
            .select({ id: oauthAuthorizationCodes.id })
            .from(oauthAuthorizationCodes)
            .where(eq(oauthAuthorizationCodes.clientId, oauthClients.id)),
        ),
      ),
    )
    .returning({ id: oauthClients.id });
  return codes.length + devices.length + tokens.length + grants.length + clients.length;
}
