import { OAUTH_MODULE_SCOPE_PREFIX, OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE } from '@bemmoly/shared';
import { appLink } from '../identity/index.ts';

/*
 * Where everything lives, from BEMMOLY_PUBLIC_URL: the issuer and its endpoints (RFC 8414),
 * the MCP server's canonical addresses that tokens are bound to (RFC 8707), and the protected
 * resource metadata that points clients at the issuer (RFC 9728).
 */

export const AUTHORIZE_PATH = '/oauth/authorize';
export const TOKEN_PATH = '/oauth/token';
export const REVOKE_PATH = '/oauth/revoke';
/** RFC 8628: where a command line tool asks for a code, and the page where it is approved. */
export const DEVICE_AUTHORIZATION_PATH = '/oauth/device_authorization';
export const DEVICE_VERIFICATION_PATH = 'device';
export const AS_METADATA_PATH = '/.well-known/oauth-authorization-server';
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

/** The issuer identifier: the public URL without a trailing slash. */
export function issuerOf(publicUrl: string): string {
  let end = publicUrl.length;
  while (end > 0 && publicUrl[end - 1] === '/') end -= 1;
  return publicUrl.slice(0, end);
}

/** The MCP server's canonical address: `/mcp`, or `/mcp/<module>` for one module. */
export function resourceFor(publicUrl: string, moduleId?: string): string {
  return appLink(publicUrl, moduleId ? `mcp/${moduleId}` : 'mcp');
}

export function resourceMetadataUrl(publicUrl: string, moduleId?: string): string {
  return appLink(publicUrl, `${RESOURCE_METADATA_PATH}/mcp${moduleId ? `/${moduleId}` : ''}`);
}

/**
 * Whether a token bound to `granted` may be used at `requested`: the same address, or the
 * whole server (`/mcp`) for one module's address.
 */
export function resourceCovers(publicUrl: string, granted: string, requested: string): boolean {
  return granted === requested || granted === resourceFor(publicUrl);
}

/** The module a resource is limited to, or null for the whole server; undefined if not ours. */
export function moduleOfResource(publicUrl: string, resource: string): string | null | undefined {
  const whole = resourceFor(publicUrl);
  if (resource === whole || resource === `${whole}/`) return null;
  if (!resource.startsWith(`${whole}/`)) return undefined;
  const id = resource.slice(whole.length + 1).replace(/\/$/, '');
  return /^[a-z][a-z0-9-]{0,39}$/.test(id) ? id : undefined;
}

export function authorizationServerMetadata(publicUrl: string, modules: readonly string[]) {
  return {
    issuer: issuerOf(publicUrl),
    authorization_endpoint: appLink(publicUrl, AUTHORIZE_PATH),
    token_endpoint: appLink(publicUrl, TOKEN_PATH),
    revocation_endpoint: appLink(publicUrl, REVOKE_PATH),
    device_authorization_endpoint: appLink(publicUrl, DEVICE_AUTHORIZATION_PATH),
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: [
      'authorization_code',
      'refresh_token',
      'urn:ietf:params:oauth:grant-type:device_code',
    ],
    code_challenge_methods_supported: ['S256'],
    // Every client is public: it proves itself with PKCE and its registered redirect.
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [
      OAUTH_SCOPE_READ,
      OAUTH_SCOPE_WRITE,
      ...modules.map((id) => `${OAUTH_MODULE_SCOPE_PREFIX}${id}`),
    ],
    service_documentation: 'https://github.com/bemmoly/bemmoly/blob/main/docs/mcp.md',
  };
}

export function protectedResourceMetadata(publicUrl: string, moduleId?: string) {
  return {
    resource: resourceFor(publicUrl, moduleId),
    authorization_servers: [issuerOf(publicUrl)],
    // The least a client needs; the person narrows it on the consent screen.
    scopes_supported: [OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE],
    bearer_methods_supported: ['header'],
    resource_name: 'Bemmoly',
  };
}

/** The 401 challenge: where the metadata is, and the scopes to ask for. */
export function bearerChallenge(publicUrl: string, moduleId?: string, error?: string): string {
  const parts = [
    'realm="bemmoly"',
    `resource_metadata="${resourceMetadataUrl(publicUrl, moduleId)}"`,
    `scope="${OAUTH_SCOPE_READ} ${OAUTH_SCOPE_WRITE}"`,
    ...(error ? [`error="${error}"`] : []),
  ];
  return `Bearer ${parts.join(', ')}`;
}
