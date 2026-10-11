import { ForbiddenError, NotFoundError, UnauthenticatedError } from '@bemmoly/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { users } from '../../models/identity/index.ts';
import { createRequestAuthorization, type ModuleCatalog } from '../authz/index.ts';
import { authenticateApiToken, type AuthenticatedToken } from '../identity/index.ts';
import { ACCESS_TOKEN_PREFIX, grantActor, type OAuthService } from '../oauth/index.ts';
import type { McpSession } from './types.ts';

export interface McpAccessDeps {
  db: Database;
  modules: ModuleCatalog;
  isEnabled(moduleId: string): boolean;
  /** Settings › MCP: whether the server answers, and the modules it exposes (null: all). */
  settings(): Promise<{ enabled: boolean; modules: readonly string[] | null }>;
  /** Access tokens from the OAuth flow; without it only personal access tokens connect. */
  oauth?: OAuthService;
  now?: () => Date;
}

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * An OAuth access token, checked against the MCP address it was issued for: a token for
 * `/mcp/work` does not open `/mcp` or `/mcp/docs`.
 */
async function fromOAuth(oauth: OAuthService, token: string, moduleId: string | undefined) {
  const grant = await oauth.authenticate(token, moduleId);
  if (!grant) {
    throw new UnauthenticatedError('The access token is invalid, expired or revoked', {
      details: { reason: 'invalid_token' },
    });
  }
  return {
    tokenId: grant.grantId,
    userId: grant.userId,
    scopes: grant.scopes,
    modules: grant.modules,
    actor: grantActor({ id: grant.grantId, userId: grant.userId }),
  };
}

/** The token behind an Authorization header; throws 401 for a missing or refused one. */
export async function authenticateMcpToken(
  deps: McpAccessDeps,
  header: string | undefined,
  moduleId?: string,
): Promise<AuthenticatedToken & { actor: Actor }> {
  const token = header ? BEARER.exec(header)?.[1] : undefined;
  if (!token) {
    throw new UnauthenticatedError(
      deps.oauth
        ? 'Sign in to connect, or send a personal access token: "Authorization: Bearer <token>"'
        : 'Connect with a personal access token: "Authorization: Bearer <token>"',
    );
  }
  if (deps.oauth && token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return fromOAuth(deps.oauth, token, moduleId);
  }
  const resolved = await authenticateApiToken(deps.db, token, deps.now?.() ?? new Date());
  if (!resolved) {
    throw new UnauthenticatedError('The access token is invalid, expired or revoked', {
      details: { reason: 'invalid_token' },
    });
  }
  return {
    ...resolved,
    actor: { kind: 'api_token', id: resolved.tokenId, userId: resolved.userId },
  };
}

/** `?modules=work,docs` or `/mcp/work`: the modules a client asked for, or null for all. */
export function requestedModules(path: string | undefined, query: string | undefined) {
  if (path) return [path];
  const listed = (query ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return listed.length > 0 ? listed : null;
}

/**
 * The session a request runs in. Off: 403 with reason mcp_disabled. A module named in the URL that is not
 * enabled and exposed: 404. Otherwise the reachable modules are the exposed ones, narrowed by
 * the URL, by the token and by the person's own grants; with none left the session simply
 * offers nothing beyond the kernel's search.
 */
export async function resolveMcpSession(
  deps: McpAccessDeps,
  token: AuthenticatedToken & { actor: Actor },
  requested: readonly string[] | null,
  meta: { ip?: string; requestId?: string },
): Promise<McpSession> {
  const settings = await deps.settings();
  if (!settings.enabled) {
    throw new ForbiddenError('An admin has turned the MCP server off in Settings › MCP', {
      details: { reason: 'mcp_disabled' },
    });
  }
  const exposed = deps.modules
    .ids()
    .filter((id) => deps.isEnabled(id))
    .filter((id) => settings.modules === null || settings.modules.includes(id));
  for (const id of requested ?? []) {
    if (!exposed.includes(id)) {
      throw new NotFoundError(`The ${id} module is not available over MCP`, {
        code: 'module_not_enabled',
      });
    }
  }
  const limit = exposed
    .filter((id) => requested === null || requested.includes(id))
    .filter((id) => token.modules === null || token.modules.includes(id));
  const authz = createRequestAuthorization({
    db: deps.db,
    modules: deps.modules,
    restrictModules: limit,
  });
  const ctx = {
    actor: token.actor,
    authz,
    ...(meta.ip ? { ip: meta.ip } : {}),
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
  };
  const reachable = await authz.modulesFor(token.actor);
  const [person] = await deps.db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, token.userId))
    .limit(1);
  return {
    ctx,
    personName: person?.name ?? 'a person',
    modules: new Set([...reachable].filter((id) => limit.includes(id))),
    writable: token.scopes.includes('write'),
  };
}
