import {
  ForbiddenError,
  NotFoundError,
  type ApiToken,
  type ApiTokenScope,
  type CreateApiTokenInput,
  type CreatedApiToken,
} from '@bemmoly/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { apiTokens, users } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { AuthorizationCache, RequestContext } from '../authz/index.ts';
import { presentApiToken } from './presenters.ts';
import {
  PERSONAL_TOKEN_PREFIX,
  PERSONAL_TOKEN_VISIBLE_CHARS,
  generateToken,
  digestToken,
} from './tokens.ts';

/** last_used_at is written at most this often per token. */
const LAST_USED_INTERVAL_MS = 60 * 1000;

/** Tokens are minted from a signed-in session, so a leaked token cannot mint more. */
function sessionUserId(ctx: RequestContext): string {
  if (ctx.actor.kind !== 'user') {
    throw new ForbiddenError('Create and manage API tokens from a signed-in session');
  }
  return ctx.actor.id;
}

export interface IssueApiTokenInput {
  userId: string;
  name: string;
  scopes: readonly ApiTokenScope[];
  modules: readonly string[] | null;
  expiresAt: Date | null;
}

/**
 * Writes a token for a person and audits it, inside the caller's transaction. Only two
 * callers: a signed-in session (below) and a device sign-in the person approved from one.
 */
export async function issueApiToken(
  tx: Database,
  input: IssueApiTokenInput,
  audit: { actor: RequestContext['actor']; meta?: RequestContext },
): Promise<CreatedApiToken> {
  const token = generateToken(PERSONAL_TOKEN_PREFIX);
  const [row] = await tx
    .insert(apiTokens)
    .values({
      userId: input.userId,
      name: input.name,
      tokenHash: digestToken(token),
      tokenPrefix: token.slice(0, PERSONAL_TOKEN_VISIBLE_CHARS),
      scopes: [...new Set(input.scopes)],
      modules: input.modules ? [...new Set(input.modules)] : null,
      expiresAt: input.expiresAt,
    })
    .returning();
  if (!row) throw new Error('API token insert returned no row');
  const apiToken = presentApiToken(row);
  await recordAudit(tx, {
    actor: audit.actor,
    action: 'api_token.created',
    target: { kind: 'api_token', id: row.id },
    after: apiToken,
    ...(audit.meta ? { meta: audit.meta } : {}),
  });
  return { token, apiToken };
}

export async function createApiToken(
  db: Database,
  ctx: RequestContext,
  input: CreateApiTokenInput,
): Promise<CreatedApiToken> {
  const userId = sessionUserId(ctx);
  return db.transaction((tx) =>
    issueApiToken(
      tx,
      {
        userId,
        name: input.name,
        scopes: input.scopes,
        modules: input.modules ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      { actor: ctx.actor, meta: ctx },
    ),
  );
}

export async function listApiTokens(db: Database, ctx: RequestContext): Promise<ApiToken[]> {
  const userId = sessionUserId(ctx);
  const rows = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.id));
  return rows.map(presentApiToken);
}

export async function revokeApiToken(db: Database, ctx: RequestContext, id: string) {
  const userId = sessionUserId(ctx);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(apiTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
      .returning();
    if (!row) throw new NotFoundError('API token not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'api_token.revoked',
      target: { kind: 'api_token', id },
      before: presentApiToken(row),
      meta: ctx,
    });
  });
}

export interface AuthenticatedToken {
  tokenId: string;
  userId: string;
  scopes: ApiTokenScope[];
  /** The modules the token is limited to; null for every module the owner can open. */
  modules: string[] | null;
}

interface TokenLookup {
  token: typeof apiTokens.$inferSelect;
  status: string;
}

async function findToken(db: Database, digest: string): Promise<TokenLookup | null> {
  const [row] = await db
    .select({ token: apiTokens, status: users.status })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, digest), isNull(apiTokens.revokedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Resolves a Bearer token; null when unknown, revoked, expired, or the owner is not active.
 * With `cache` (the server's process cache) a known token is looked up at most once per TTL;
 * revoking it or deactivating its owner clears the cache when that write commits, and
 * expiry is checked against `now` on every call, cached or not.
 */
export async function authenticateApiToken(
  db: Database,
  token: string,
  now: Date,
  cache?: AuthorizationCache,
): Promise<AuthenticatedToken | null> {
  if (!token.startsWith(PERSONAL_TOKEN_PREFIX)) return null;
  const digest = digestToken(token);
  const key = `token|${digest}`;
  const row = cache
    ? await cache.memo(key, () => findToken(db, digest))
    : await findToken(db, digest);
  // Unknown tokens are not kept, so guessing cannot fill the cache.
  if (!row) {
    cache?.forget(key);
    return null;
  }
  if (row.token.expiresAt && row.token.expiresAt.getTime() <= now.getTime()) return null;
  if (row.status !== 'active') return null;
  const lastUsed = row.token.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > LAST_USED_INTERVAL_MS) {
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.token.id));
    // The cached row would otherwise ask for this write again on every request.
    row.token.lastUsedAt = now;
  }
  return {
    tokenId: row.token.id,
    userId: row.token.userId,
    scopes: presentApiToken(row.token).scopes,
    modules: row.token.modules ?? null,
  };
}
