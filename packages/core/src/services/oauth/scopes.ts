import {
  OAUTH_MODULE_SCOPE_PREFIX,
  OAUTH_SCOPE_READ,
  OAUTH_SCOPE_WRITE,
  type ApiTokenScope,
  type OAuthAccess,
} from '@bemmoly/shared';

export interface RequestedScope {
  access: OAuthAccess;
  /** Null when the client named no module: every module the person can open. */
  modules: string[] | null;
}

const MODULE_ID = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * Reads a scope string. A client that names neither access scope may be given either; one that
 * asks for read only gets read only. Scopes this server does not know are ignored, as RFC 6749
 * lets an authorization server narrow what it grants.
 */
export function parseScope(scope: string | undefined): RequestedScope {
  const items = (scope ?? '').split(/\s+/).filter(Boolean);
  const read = items.includes(OAUTH_SCOPE_READ);
  const write = items.includes(OAUTH_SCOPE_WRITE);
  const modules = [
    ...new Set(
      items
        .filter((item) => item.startsWith(OAUTH_MODULE_SCOPE_PREFIX))
        .map((item) => item.slice(OAUTH_MODULE_SCOPE_PREFIX.length))
        .filter((id) => MODULE_ID.test(id)),
    ),
  ];
  return {
    access: write || !read ? 'write' : 'read',
    modules: modules.length > 0 ? modules : null,
  };
}

export const tokenScopesFor = (access: OAuthAccess): ApiTokenScope[] =>
  access === 'write' ? ['read', 'write'] : ['read'];

export const accessOf = (scopes: readonly string[]): OAuthAccess =>
  scopes.includes('write') ? 'write' : 'read';

/** The scope string a token response reports back to the client. */
export function formatScope(scopes: readonly string[], modules: readonly string[] | null): string {
  return [
    OAUTH_SCOPE_READ,
    ...(scopes.includes('write') ? [OAUTH_SCOPE_WRITE] : []),
    ...(modules ?? []).map((id) => `${OAUTH_MODULE_SCOPE_PREFIX}${id}`),
  ].join(' ');
}
