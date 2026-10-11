import {
  createOAuthConsentSchema,
  type OAuthAuthorizeRequest,
  type OAuthClientSummary,
  type OAuthGrant,
} from '@bemmoly/shared';
import { audit, currentUser, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';

/** Client metadata documents the mock knows, as their publishers would serve them. */
const CLIENTS: Record<string, { name: string; redirects: string[] }> = {
  'https://desk.example/oauth/client.json': {
    name: 'Desk Assistant',
    redirects: ['http://localhost/callback'],
  },
  'https://agents.example/mcp/client.json': {
    name: 'Agent Studio',
    redirects: ['https://agents.example/oauth/callback'],
  },
};

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function redirectAllowed(registered: string[], asked: string): boolean {
  if (registered.includes(asked)) return true;
  try {
    const url = new URL(asked);
    if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname)) return false;
    return registered.some((entry) => {
      const known = new URL(entry);
      return known.hostname === url.hostname && known.pathname === url.pathname;
    });
  } catch {
    return false;
  }
}

function requestOf(request: MockRequest): OAuthAuthorizeRequest {
  return Object.fromEntries(request.query.entries()) as unknown as OAuthAuthorizeRequest;
}

/** The checks the server makes before showing or deciding; a response when it refuses. */
function check(db: MockDb, request: OAuthAuthorizeRequest) {
  if (db.settings['mcp.enabled'] !== true) {
    return fail(403, 'forbidden', 'An admin has turned the MCP server off in Settings › MCP', {
      reason: 'mcp_disabled',
    });
  }
  const client = CLIENTS[request.client_id];
  if (!client) {
    return fail(
      400,
      'validation_failed',
      'This app did not identify itself with a web address Bemmoly can check',
      {
        reason: 'invalid_client',
      },
    );
  }
  if (!redirectAllowed(client.redirects, request.redirect_uri)) {
    return fail(
      400,
      'validation_failed',
      `${client.name} asked to send you back to an address it has not registered, so Bemmoly won't continue`,
      { reason: 'invalid_redirect' },
    );
  }
  const redirect = new URL(request.redirect_uri);
  const summary: OAuthClientSummary = {
    id: request.client_id,
    name: client.name,
    host: new URL(request.client_id).host,
    redirectUri: request.redirect_uri,
    redirectHost: redirect.host,
    loopback: redirect.protocol === 'http:' && LOOPBACK.has(redirect.hostname),
  };
  return summary;
}

const back = (request: OAuthAuthorizeRequest, params: Record<string, string>) => {
  const url = new URL(request.redirect_uri);
  for (const [key, value] of Object.entries({ ...params, state: request.state ?? '' })) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
};

function modules(db: MockDb) {
  return db.adminModules
    .filter((module) => module.enabled)
    .map((module) => ({ id: module.id, name: module.name }));
}

const grantsOf = (db: MockDb): OAuthGrant[] => (db.oauthGrants ??= []);

/** MCP client sign-in: the consent screen and Connected apps, as the server answers them. */
export const oauthRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/oauth/authorization-requests',
    handle: (request, db) => {
      const asked = requestOf(request);
      const checked = check(db, asked);
      if ('status' in checked) return checked;
      if (!asked.code_challenge || asked.code_challenge_method !== 'S256') {
        const description = 'A PKCE code challenge is required';
        return ok({
          status: 'invalid',
          client: checked,
          error: 'invalid_request',
          description,
          redirectUrl: back(asked, { error: 'invalid_request', error_description: description }),
        });
      }
      const scope = (asked.scope ?? '').split(' ');
      const named = scope.filter((item) => item.startsWith('module:')).map((item) => item.slice(7));
      return ok({
        status: 'ready',
        client: checked,
        access: scope.includes('mcp:read') && !scope.includes('mcp:write') ? 'read' : 'write',
        requestedModules: named.length ? named : null,
        moduleOptions: modules(db).filter((option) => !named.length || named.includes(option.id)),
      });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/oauth/consents',
    handle: (request, db) => {
      const input = createOAuthConsentSchema.parse(request.body);
      const checked = check(db, input.request);
      if ('status' in checked) return checked;
      if (!input.approve) {
        audit(db, 'oauth.authorization_denied', 'oauth_client', checked.id);
        return ok({ redirectUrl: back(input.request, { error: 'access_denied' }) }, 201);
      }
      const now = new Date().toISOString();
      grantsOf(db).unshift({
        id: newId(),
        client: { id: checked.id, name: checked.name, host: checked.host },
        access: input.access ?? 'write',
        modules: input.modules ?? null,
        resource: 'http://localhost:5173/mcp',
        lastUsedAt: now,
        createdAt: now,
      });
      audit(db, 'oauth.authorization_approved', 'oauth_client', checked.id);
      return ok({ redirectUrl: back(input.request, { code: `mock-${newId()}` }) }, 201);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/oauth/grants',
    handle: (_, db) => (currentUser(db) ? ok({ items: grantsOf(db) }) : notFound('Person')),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/oauth/grants/:id',
    handle: (request, db) => {
      const grants = grantsOf(db);
      const index = grants.findIndex((grant) => grant.id === request.params['id']);
      if (index < 0) return notFound('Connected app');
      grants.splice(index, 1);
      audit(db, 'oauth.grant_revoked', 'oauth_grant', request.params['id'] ?? null);
      return ok();
    },
  },
];
