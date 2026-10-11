import { describe, expect, it } from 'vitest';
import { parseClientId } from './clients.ts';
import { isAcceptableRedirect, redirectMatches, withParams } from './redirects.ts';
import { formatScope, parseScope } from './scopes.ts';
import {
  authorizationServerMetadata,
  bearerChallenge,
  moduleOfResource,
  protectedResourceMetadata,
  resourceCovers,
  resourceFor,
} from './urls.ts';

const BASE = 'https://bemmoly.acme.dev';

describe('scopes', () => {
  it('reads access and modules, ignoring scopes it does not know', () => {
    expect(parseScope('mcp:read mcp:write')).toEqual({ access: 'write', modules: null });
    expect(parseScope('mcp:read module:work offline_access')).toEqual({
      access: 'read',
      modules: ['work'],
    });
    expect(parseScope('module:Work module:../x')).toEqual({ access: 'write', modules: null });
  });

  it('lets a client that names no access scope be given either', () => {
    expect(parseScope(undefined)).toEqual({ access: 'write', modules: null });
    expect(parseScope('')).toEqual({ access: 'write', modules: null });
  });

  it('reports what was granted', () => {
    expect(formatScope(['read'], null)).toBe('mcp:read');
    expect(formatScope(['read', 'write'], ['work'])).toBe('mcp:read mcp:write module:work');
  });
});

describe('redirects', () => {
  it('allows https and the loopback interface only', () => {
    expect(isAcceptableRedirect('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAcceptableRedirect('http://localhost:33418/callback')).toBe(true);
    expect(isAcceptableRedirect('http://127.0.0.1/callback')).toBe(true);
    expect(isAcceptableRedirect('http://evil.example/callback')).toBe(false);
    expect(isAcceptableRedirect('javascript:alert(1)')).toBe(false);
    expect(isAcceptableRedirect('https://a.example/cb#frag')).toBe(false);
    expect(isAcceptableRedirect('https://user:pw@a.example/cb')).toBe(false);
  });

  it('matches exactly, except a loopback port, which the app picks at run time', () => {
    const registered = ['https://app.example/cb', 'http://localhost/callback'];
    expect(redirectMatches('https://app.example/cb', registered)).toBe(true);
    expect(redirectMatches('https://app.example/cb?x=1', registered)).toBe(false);
    expect(redirectMatches('https://app.example/cb/', registered)).toBe(false);
    expect(redirectMatches('http://localhost:51234/callback', registered)).toBe(true);
    expect(redirectMatches('http://localhost:51234/other', registered)).toBe(false);
    expect(redirectMatches('http://127.0.0.1:51234/callback', registered)).toBe(false);
  });

  it('adds response parameters and keeps the redirect’s own query', () => {
    expect(withParams('https://app.example/cb?keep=1', { code: 'c', state: undefined })).toBe(
      'https://app.example/cb?keep=1&code=c',
    );
  });
});

describe('client ids', () => {
  it('are https addresses with a path, in canonical form', () => {
    expect(parseClientId('https://app.example/oauth/client.json').host).toBe('app.example');
    for (const bad of [
      'http://app.example/client.json',
      'https://app.example/',
      'https://app.example',
      'https://app.example/a/../client.json',
      'https://user@app.example/client.json',
      'https://APP.example/client.json',
      'not a url',
    ]) {
      expect(() => parseClientId(bad), bad).toThrow();
    }
  });
});

describe('resources and metadata', () => {
  it('binds tokens to /mcp or one module’s /mcp/<id>', () => {
    expect(resourceFor(BASE)).toBe(`${BASE}/mcp`);
    expect(moduleOfResource(BASE, `${BASE}/mcp`)).toBeNull();
    expect(moduleOfResource(BASE, `${BASE}/mcp/work`)).toBe('work');
    expect(moduleOfResource(BASE, 'https://other.example/mcp')).toBeUndefined();
    expect(moduleOfResource(BASE, `${BASE}/mcpx`)).toBeUndefined();
    expect(resourceCovers(BASE, `${BASE}/mcp`, `${BASE}/mcp/work`)).toBe(true);
    expect(resourceCovers(BASE, `${BASE}/mcp/work`, `${BASE}/mcp`)).toBe(false);
    expect(resourceCovers(BASE, `${BASE}/mcp/work`, `${BASE}/mcp/docs`)).toBe(false);
  });

  it('advertises PKCE, public clients and metadata documents, and no registration endpoint', () => {
    const metadata = authorizationServerMetadata(`${BASE}/`, ['work']);
    expect(metadata.issuer).toBe(BASE);
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(metadata.client_id_metadata_document_supported).toBe(true);
    expect(metadata).not.toHaveProperty('registration_endpoint');
    expect(metadata.scopes_supported).toContain('module:work');
    expect(protectedResourceMetadata(BASE, 'work')).toMatchObject({
      resource: `${BASE}/mcp/work`,
      authorization_servers: [BASE],
    });
    expect(bearerChallenge(BASE, undefined, 'invalid_token')).toBe(
      `Bearer realm="bemmoly", resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp", scope="mcp:read mcp:write", error="invalid_token"`,
    );
  });
});
