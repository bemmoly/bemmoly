import {
  ForbiddenError,
  NotFoundError,
  UPLOAD_LINK_TTL_MINUTES,
  ValidationError,
  type UploadedFile,
  type UploadFileQuery,
  type UploadLink,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { RequestAuthorization, RequestContext } from '../authz/index.ts';
import { digestToken, generateToken } from '../identity/index.ts';

/*
 * Single-use upload links (ADR 0048): an MCP tool hands one to the agent, and whatever can
 * read the file sends the bytes to it, so a large file never passes through the model. The
 * link acts as the token or connection that asked for it, and the upload itself is the
 * files service's, with every check it makes.
 */

export const UPLOAD_LINK_PREFIX = 'bmu_';
/** Links are kept a day past their expiry, so a late attempt still says why it failed. */
const KEEP_HOURS = 24;

export interface UploadLinkDeps {
  sql: SqlClient;
  /** Where links point: the install's public address. */
  publicUrl: string;
  maxBytes: number;
  logger: Logger;
  /** May the person add files to this target; throws otherwise. */
  assertWritable(ctx: RequestContext, kind: string, targetId: string): Promise<void>;
  upload(ctx: RequestContext, query: UploadFileQuery, body: Buffer): Promise<UploadedFile>;
}

interface LinkRow {
  id: string;
  user_id: string;
  credential_id: string;
  target_kind: string;
  target_id: string;
  filename: string | null;
}

/**
 * Links are for the personal token or OAuth connection an MCP client acts with: they are
 * checked again on use, which a session (whose agent has no shell anyway) would not be.
 */
function credentialOf(actor: Actor): { userId: string; credentialId: string } {
  if (actor.kind === 'api_token' && actor.userId) {
    return { userId: actor.userId, credentialId: actor.id };
  }
  throw new ForbiddenError('Upload links are for MCP clients, through their access token');
}

const actorOf = (row: LinkRow): Actor => ({
  kind: 'api_token',
  id: row.credential_id,
  userId: row.user_id,
});

/** Targets are namespaced by module: "docs.page" belongs to docs. */
const moduleOf = (kind: string) => kind.slice(0, kind.indexOf('.'));

const linkUrl = (publicUrl: string, token: string) =>
  `${publicUrl.replace(/\/+$/, '')}/api/v1/upload-links/${token}`;

export function createUploadLinks(deps: UploadLinkDeps) {
  /**
   * The token or connection is live, may still write and still reaches the target's module,
   * and its person is active; the same limits the request that made the link ran under.
   */
  async function stillLive(row: LinkRow): Promise<boolean> {
    const [live] = await deps.sql<{ modules: string[] | null }[]>`
      select t.modules from api_tokens t join users u on u.id = t.user_id
      where t.id = ${row.credential_id} and t.user_id = ${row.user_id} and u.status = 'active'
        and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
        and 'write' = any (t.scopes)
      union all
      select g.modules from oauth_grants g join users u on u.id = g.user_id
      where g.id = ${row.credential_id} and g.user_id = ${row.user_id} and u.status = 'active'
        and g.revoked_at is null and 'write' = any (g.scopes)
      limit 1`;
    if (!live) return false;
    return live.modules === null || live.modules.includes(moduleOf(row.target_kind));
  }

  /** Why a token that claimed nothing was refused, in words the agent can act on. */
  async function refusalFor(tokenHash: string): Promise<NotFoundError> {
    const [row] = await deps.sql<{ used: boolean; expired: boolean }[]>`
      select used_at is not null as used, expires_at <= now() as expired
      from file_upload_links where token_hash = ${tokenHash}`;
    const reason = !row ? 'unknown' : row.used ? 'used' : row.expired ? 'expired' : 'unknown';
    return new NotFoundError(
      reason === 'unknown'
        ? 'The upload link was not found'
        : `The upload link was already ${reason}; ask for a new one`,
      { details: { reason } },
    );
  }

  return {
    /** A link for one file into the target, after the same check as an upload. */
    async create(ctx: RequestContext, query: UploadFileQuery): Promise<UploadLink> {
      const { userId, credentialId } = credentialOf(ctx.actor);
      await deps.assertWritable(ctx, query.target, query.targetId);
      const token = generateToken(UPLOAD_LINK_PREFIX);
      const [row] = await deps.sql<{ expires_at: string | Date }[]>`
        insert into file_upload_links (token_hash, user_id, credential_id, target_kind,
          target_id, filename, expires_at)
        values (${digestToken(token)}, ${userId}, ${credentialId}, ${query.target},
          ${query.targetId}, ${query.name ?? null},
          now() + make_interval(mins => ${UPLOAD_LINK_TTL_MINUTES}))
        returning expires_at`;
      return {
        url: linkUrl(deps.publicUrl, token),
        method: 'PUT',
        expiresAt: new Date(row!.expires_at).toISOString(),
        maxBytes: deps.maxBytes,
      };
    },

    /**
     * Stores the bytes as the link's person. The link is claimed first, so two requests with
     * it store at most one file; invalid bytes give it back for another try.
     */
    async use(
      token: string,
      body: Buffer,
      request: { authz: RequestAuthorization; ip?: string; requestId?: string },
    ): Promise<UploadedFile> {
      const tokenHash = digestToken(token);
      const [row] = await deps.sql<LinkRow[]>`
        update file_upload_links set used_at = now()
        where token_hash = ${tokenHash} and used_at is null and expires_at > now()
        returning id, user_id, credential_id, target_kind, target_id, filename`;
      if (!row) throw await refusalFor(tokenHash);
      if (!(await stillLive(row))) {
        throw new ForbiddenError('The connection that asked for this upload link has ended', {
          details: { reason: 'revoked' },
        });
      }
      const ctx: RequestContext = {
        actor: actorOf(row),
        authz: request.authz,
        ...(request.ip ? { ip: request.ip } : {}),
        ...(request.requestId ? { requestId: request.requestId } : {}),
      };
      const query: UploadFileQuery = {
        target: row.target_kind,
        targetId: row.target_id,
        name: row.filename ?? undefined,
      };
      try {
        const file = await deps.upload(ctx, query, body);
        await deps.sql`update file_upload_links set file_id = ${file.id} where id = ${row.id}`;
        return file;
      } catch (error) {
        if (error instanceof ValidationError) {
          await deps.sql`update file_upload_links set used_at = null where id = ${row.id}`;
        }
        throw error;
      }
    },

    /** Housekeeping: links a day past their expiry. */
    async cleanup(now: Date): Promise<number> {
      const before = new Date(now.getTime() - KEEP_HOURS * 3_600_000).toISOString();
      const deleted = await deps.sql`
        delete from file_upload_links where expires_at < ${before}::timestamptz returning id`;
      if (deleted.length > 0) deps.logger.info({ removed: deleted.length }, 'upload links deleted');
      return deleted.length;
    },
  };
}
