import {
  NotFoundError,
  SCIM_TOKEN_PREFIX,
  type CreatedScimToken,
  type CreateScimTokenInput,
  type ScimToken,
} from '@bemmoly/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { scimTokens, type ScimTokenRow } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { digestToken, generateToken } from '../identity/index.ts';

const CONFIGURE = 'workspace.sso.configure' as const;
/** Characters of the token kept in clear so admins can tell tokens apart. */
const VISIBLE_CHARS = 14;

function presentScimToken(row: ScimTokenRow): ScimToken {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScimTokens(db: Database, ctx: RequestContext): Promise<ScimToken[]> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const rows = await db
    .select()
    .from(scimTokens)
    .where(isNull(scimTokens.revokedAt))
    .orderBy(asc(scimTokens.createdAt));
  return rows.map(presentScimToken);
}

/** The secret is returned once and stored as a digest. */
export async function createScimToken(
  db: Database,
  ctx: RequestContext,
  input: CreateScimTokenInput,
): Promise<CreatedScimToken> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const token = generateToken(SCIM_TOKEN_PREFIX);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(scimTokens)
      .values({
        name: input.name,
        prefix: token.slice(0, VISIBLE_CHARS),
        tokenHash: digestToken(token),
        createdBy: ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? null),
      })
      .returning();
    if (!row) throw new Error('SCIM token insert returned no row');
    const scimToken = presentScimToken(row);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'scim.token_created',
      target: { kind: 'scim_token', id: row.id },
      after: scimToken,
      meta: ctx,
    });
    return { token, scimToken };
  });
}

export async function revokeScimToken(
  db: Database,
  ctx: RequestContext,
  id: string,
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(scimTokens)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(eq(scimTokens.id, id), isNull(scimTokens.revokedAt)))
      .returning();
    if (!row) throw new NotFoundError('SCIM token not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'scim.token_revoked',
      target: { kind: 'scim_token', id },
      before: presentScimToken(row),
      meta: ctx,
    });
  });
}

/** The provisioning actor behind a bearer token, or null for unknown or revoked tokens. */
export async function authenticateScimToken(
  db: Database,
  token: string,
  now: Date,
): Promise<Actor | null> {
  if (!token.startsWith(SCIM_TOKEN_PREFIX)) return null;
  const [row] = await db
    .update(scimTokens)
    .set({ lastUsedAt: now })
    .where(and(eq(scimTokens.tokenHash, digestToken(token)), isNull(scimTokens.revokedAt)))
    .returning({ id: scimTokens.id });
  return row ? { kind: 'system', id: `scim:${row.id}` } : null;
}
