import {
  ForbiddenError,
  NotFoundError,
  type ApiToken,
  type ApiTokenScope,
  type CreateApiTokenInput,
  type CreatedApiToken,
} from '@bemmoly/shared';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { apiTokens, users } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { presentApiToken } from './presenters.ts';
import {
  API_TOKEN_PREFIX,
  API_TOKEN_VISIBLE_CHARS,
  generateSecret,
  hashSecret,
} from './secrets.ts';

/** last_used_at is written at most this often per token. */
const LAST_USED_INTERVAL_MS = 60 * 1000;

/** Tokens are minted from a signed-in session, so a leaked token cannot mint more. */
function sessionUserId(ctx: RequestContext): string {
  if (ctx.actor.kind !== 'user') {
    throw new ForbiddenError('Create and manage API tokens from a signed-in session');
  }
  return ctx.actor.id;
}

export async function createApiToken(
  db: Database,
  ctx: RequestContext,
  input: CreateApiTokenInput,
): Promise<CreatedApiToken> {
  const userId = sessionUserId(ctx);
  const token = generateSecret(API_TOKEN_PREFIX);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(apiTokens)
      .values({
        userId,
        name: input.name,
        tokenHash: hashSecret(token),
        tokenPrefix: token.slice(0, API_TOKEN_VISIBLE_CHARS),
        scopes: [...new Set(input.scopes)],
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();
    if (!row) throw new Error('API token insert returned no row');
    const apiToken = presentApiToken(row);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'api_token.created',
      target: { kind: 'api_token', id: row.id },
      after: apiToken,
      meta: ctx,
    });
    return { token, apiToken };
  });
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
}

/** Resolves a Bearer token; null when unknown, revoked, expired, or the owner is not active. */
export async function authenticateApiToken(
  db: Database,
  token: string,
  now: Date,
): Promise<AuthenticatedToken | null> {
  if (!token.startsWith(API_TOKEN_PREFIX)) return null;
  const [row] = await db
    .select({ token: apiTokens, status: users.status })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(
      and(
        eq(apiTokens.tokenHash, hashSecret(token)),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
      ),
    )
    .limit(1);
  if (!row || row.status !== 'active') return null;
  const lastUsed = row.token.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > LAST_USED_INTERVAL_MS) {
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.token.id));
  }
  return {
    tokenId: row.token.id,
    userId: row.token.userId,
    scopes: presentApiToken(row.token).scopes,
  };
}
