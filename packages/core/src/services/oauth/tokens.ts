import { createHash } from 'node:crypto';
import type { OAuthRevokeRequest, OAuthTokenRequest } from '@bemmoly/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import {
  oauthAuthorizationCodes,
  oauthClients,
  oauthGrants,
  oauthTokens,
  users,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { digestToken, generateToken } from '../identity/index.ts';
import { knownClient } from './clients.ts';
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_MS,
  nowOf,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_MS,
  type OAuthDependencies,
} from './deps.ts';
import { invalidGrant, OAuthProtocolError } from './errors.ts';
import { formatScope } from './scopes.ts';
import { moduleOfResource, resourceCovers, resourceFor } from './urls.ts';

type CodeGrant = Extract<OAuthTokenRequest, { grant_type: 'authorization_code' }>;
type RefreshGrant = Extract<OAuthTokenRequest, { grant_type: 'refresh_token' }>;

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/** A connection acts as its person through the MCP server, like a personal token does. */
export const grantActor = (grant: { id: string; userId: string }): Actor => ({
  kind: 'api_token',
  id: grant.id,
  userId: grant.userId,
});

const pkceChallengeOf = (verifier: string) =>
  createHash('sha256').update(verifier, 'ascii').digest('base64url');

/** The canonical form of a `resource` the client sent, or a refusal if it is not ours. */
function canonicalResource(deps: OAuthDependencies, resource: string): string {
  const moduleId = moduleOfResource(deps.publicUrl, resource);
  if (moduleId === undefined) {
    throw new OAuthProtocolError('invalid_target', 'The resource is not this MCP server');
  }
  return resourceFor(deps.publicUrl, moduleId ?? undefined);
}

async function issuePair(tx: Database, grant: { id: string }, now: Date) {
  const access = generateToken(ACCESS_TOKEN_PREFIX);
  const refresh = generateToken(REFRESH_TOKEN_PREFIX);
  await tx.insert(oauthTokens).values([
    {
      grantId: grant.id,
      kind: 'access',
      tokenHash: digestToken(access),
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    },
    {
      grantId: grant.id,
      kind: 'refresh',
      tokenHash: digestToken(refresh),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    },
  ]);
  return { access, refresh };
}

const responseOf = (
  pair: { access: string; refresh: string },
  grant: { scopes: string[]; modules: string[] | null },
): TokenResponse => ({
  access_token: pair.access,
  token_type: 'Bearer',
  expires_in: ACCESS_TOKEN_TTL_MS / 1000,
  refresh_token: pair.refresh,
  scope: formatScope(grant.scopes, grant.modules),
});

/** Revokes a whole connection after a replayed code or refresh token, and says why. */
async function revokeForReplay(tx: Database, grantId: string, userId: string, reason: string) {
  const [revoked] = await tx
    .update(oauthGrants)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)))
    .returning({ id: oauthGrants.id });
  if (!revoked) return;
  await recordAudit(tx, {
    actor: { kind: 'system', id: 'oauth' },
    action: 'oauth.grant_revoked',
    target: { kind: 'oauth_grant', id: grantId },
    after: { reason, userId },
  });
}

/** authorization_code: the one-time code, its PKCE verifier and the same redirect. */
export async function exchangeCode(deps: OAuthDependencies, input: CodeGrant) {
  const client = await knownClient(deps, input.client_id);
  if (!client) throw new OAuthProtocolError('invalid_client', 'Unknown client', 401);
  const now = nowOf(deps);
  const outcome = await deps.db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.codeHash, digestToken(input.code)))
      .for('update');
    if (!code || code.clientId !== client.id) return invalidGrant('The code is not valid');
    if (code.consumedAt) {
      // A code presented twice was intercepted: what it became may be in the wrong hands.
      if (code.grantId) await revokeForReplay(tx, code.grantId, code.userId, 'code_reused');
      return invalidGrant('The code was already used');
    }
    if (code.expiresAt <= now) return invalidGrant('The code has expired');
    if (code.redirectUri !== input.redirect_uri) {
      return invalidGrant('The redirect does not match the authorization request');
    }
    if (input.resource && canonicalResource(deps, input.resource) !== code.resource) {
      return new OAuthProtocolError('invalid_target', 'The resource does not match the code');
    }
    if (pkceChallengeOf(input.code_verifier) !== code.codeChallenge) {
      return invalidGrant('The code verifier does not match the code challenge');
    }
    const [person] = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, code.userId));
    if (person?.status !== 'active') return invalidGrant('The account is not active');
    const [grant] = await tx
      .insert(oauthGrants)
      .values({
        userId: code.userId,
        clientId: client.id,
        resource: code.resource,
        scopes: code.scopes,
        modules: code.modules,
        lastUsedAt: now,
      })
      .returning();
    if (!grant) throw new Error('OAuth grant insert returned no row');
    await tx
      .update(oauthAuthorizationCodes)
      .set({ consumedAt: now, grantId: grant.id, updatedAt: now })
      .where(eq(oauthAuthorizationCodes.id, code.id));
    const pair = await issuePair(tx, grant, now);
    await recordAudit(tx, {
      actor: grantActor(grant),
      action: 'oauth.grant_created',
      target: { kind: 'oauth_grant', id: grant.id },
      after: { client: client.name, resource: grant.resource, scopes: grant.scopes },
    });
    return responseOf(pair, grant);
  });
  if (outcome instanceof OAuthProtocolError) throw outcome;
  return outcome;
}

/** refresh_token: used once; the reply carries a new pair. Presented again, it ends the grant. */
export async function refreshTokens(deps: OAuthDependencies, input: RefreshGrant) {
  const now = nowOf(deps);
  const outcome = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        token: oauthTokens,
        grant: oauthGrants,
        client: oauthClients,
        status: users.status,
      })
      .from(oauthTokens)
      .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
      .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .innerJoin(users, eq(users.id, oauthGrants.userId))
      .where(
        and(
          eq(oauthTokens.tokenHash, digestToken(input.refresh_token)),
          eq(oauthTokens.kind, 'refresh'),
        ),
      )
      .for('update', { of: oauthTokens });
    if (!row || row.client.clientId !== input.client_id) {
      return invalidGrant('The refresh token is not valid');
    }
    if (row.grant.revokedAt) return invalidGrant('The connection was revoked');
    if (row.token.consumedAt) {
      await revokeForReplay(tx, row.grant.id, row.grant.userId, 'refresh_token_reused');
      return invalidGrant('The refresh token was already used');
    }
    if (row.token.expiresAt <= now) return invalidGrant('The refresh token has expired');
    if (row.status !== 'active') return invalidGrant('The account is not active');
    if (
      input.resource &&
      !resourceCovers(deps.publicUrl, row.grant.resource, canonicalResource(deps, input.resource))
    ) {
      return new OAuthProtocolError('invalid_target', 'The resource is outside this connection');
    }
    await tx
      .update(oauthTokens)
      .set({ consumedAt: now, updatedAt: now })
      .where(eq(oauthTokens.id, row.token.id));
    await tx
      .update(oauthGrants)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(oauthGrants.id, row.grant.id));
    return responseOf(await issuePair(tx, row.grant, now), row.grant);
  });
  if (outcome instanceof OAuthProtocolError) throw outcome;
  return outcome;
}

/** RFC 7009: revoking either token of a connection ends the connection. Unknown is fine. */
export async function revokeToken(deps: OAuthDependencies, input: OAuthRevokeRequest) {
  await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select({ grant: oauthGrants, clientId: oauthClients.clientId })
      .from(oauthTokens)
      .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
      .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .where(
        and(eq(oauthTokens.tokenHash, digestToken(input.token)), isNull(oauthGrants.revokedAt)),
      );
    if (!row || (input.client_id && input.client_id !== row.clientId)) return;
    await tx
      .update(oauthGrants)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(oauthGrants.id, row.grant.id));
    await recordAudit(tx, {
      actor: grantActor(row.grant),
      action: 'oauth.grant_revoked',
      target: { kind: 'oauth_grant', id: row.grant.id },
      after: { reason: 'client_revoked' },
    });
  });
}

/** last_used_at is written at most this often per connection. */
const LAST_USED_INTERVAL_MS = 60 * 1000;

export interface AuthenticatedGrant {
  grantId: string;
  userId: string;
  scopes: ('read' | 'write')[];
  modules: string[] | null;
  resource: string;
}

/** An access token presented to the MCP server; null when unknown, expired or revoked. */
export async function authenticateAccessToken(
  deps: OAuthDependencies,
  token: string,
): Promise<AuthenticatedGrant | null> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const now = nowOf(deps);
  const [row] = await deps.db
    .select({ grant: oauthGrants, status: users.status })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .innerJoin(users, eq(users.id, oauthGrants.userId))
    .where(
      and(
        eq(oauthTokens.tokenHash, digestToken(token)),
        eq(oauthTokens.kind, 'access'),
        gt(oauthTokens.expiresAt, now),
        isNull(oauthGrants.revokedAt),
      ),
    )
    .limit(1);
  if (!row || row.status !== 'active') return null;
  if (now.getTime() - (row.grant.lastUsedAt?.getTime() ?? 0) > LAST_USED_INTERVAL_MS) {
    await deps.db
      .update(oauthGrants)
      .set({ lastUsedAt: now })
      .where(eq(oauthGrants.id, row.grant.id));
  }
  return {
    grantId: row.grant.id,
    userId: row.grant.userId,
    scopes: row.grant.scopes.includes('write') ? ['read', 'write'] : ['read'],
    modules: row.grant.modules ?? null,
    resource: row.grant.resource,
  };
}
