import type { FetchClientMetadata } from '@bemmoly/core';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { expect } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import { caller, seedWorkspace, setSetting, type Call } from './mcp-harness.ts';

/*
 * What the MCP OAuth integration tests share: client ID metadata documents served without a
 * network, an in-memory OAuthClientProvider for the official SDK client (it records the
 * authorization URL instead of opening a browser), and the real host listening on a port.
 */

export const DESK_CLIENT = 'https://desk.example/oauth/client.json';
export const CLI_CLIENT = 'https://cli.example/oauth/client.json';
export const DESK_REDIRECT = 'http://localhost:7123/callback';

const DOCUMENTS: Record<string, unknown> = {
  [DESK_CLIENT]: {
    client_id: DESK_CLIENT,
    client_name: 'Desk Assistant',
    redirect_uris: ['http://localhost/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  },
  [CLI_CLIENT]: {
    client_id: CLI_CLIENT,
    client_name: 'Terminal Agent',
    redirect_uris: ['https://cli.example/callback'],
    token_endpoint_auth_method: 'none',
  },
};

/** Counts fetches, so tests can see the cache at work. */
export const fetched: string[] = [];

export const fakeClientMetadata: FetchClientMetadata = async (url) => {
  fetched.push(url);
  const body = DOCUMENTS[url];
  if (!body) throw new Error(`${url} answered 404`);
  return { body, maxAgeSeconds: 600 };
};

/** The SDK client's side of the flow, kept in memory. */
export class MemoryOAuthProvider implements OAuthClientProvider {
  authorizationUrl: URL | undefined;
  saved: OAuthTokens | undefined;
  readonly clientMetadataUrl: string;
  readonly redirectUrl: string;
  private readonly stateValue: string;
  private client: OAuthClientInformationMixed | undefined;
  private verifier = '';

  constructor(clientMetadataUrl: string, redirectUrl: string, stateValue = 'state-123') {
    this.clientMetadataUrl = clientMetadataUrl;
    this.redirectUrl = redirectUrl;
    this.stateValue = stateValue;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Test client',
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
    };
  }

  state() {
    return this.stateValue;
  }
  clientInformation() {
    return this.client;
  }
  saveClientInformation(info: OAuthClientInformationMixed) {
    this.client = info;
  }
  tokens() {
    return this.saved;
  }
  saveTokens(tokens: OAuthTokens) {
    this.saved = tokens;
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }
  saveCodeVerifier(verifier: string) {
    this.verifier = verifier;
  }
  codeVerifier() {
    return this.verifier;
  }
}

/** The authorization request's parameters, as the consent page reads them from its address. */
export const requestOf = (url: URL): Record<string, string> =>
  Object.fromEntries(url.searchParams.entries());

export interface OAuthRun {
  harness: BootHarness;
  app: SignedInApp;
  call: Call;
  base: string;
}

/** The whole host on its own database, with Work and Docs, MCP on, listening on `port`. */
export async function startOAuthRun(
  port: number,
): Promise<{ run: OAuthRun } | { run: undefined; reason: string }> {
  const base = `http://127.0.0.1:${port}`;
  const started = await startBootHarness({ origin: base, fetchClientMetadata: fakeClientMetadata });
  if (!started.available) return { run: undefined, reason: started.reason };
  const app = await started.harness.boot();
  const call = caller(app);
  await seedWorkspace(call);
  await setSetting(call, 'mcp.enabled', true);
  await app.instance.app.listen({ port, host: '127.0.0.1' });
  return { run: { harness: started.harness, app, call, base } };
}

/** The steps a client and a person take, against one run. */
export function oauthSteps({ app, base }: OAuthRun) {
  /** The consent screen's two calls, made with the admin's session cookie. */
  async function consent(url: URL, decision: Record<string, unknown> = { approve: true }) {
    const query = new URLSearchParams(requestOf(url)).toString();
    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/oauth/authorization-requests?${query}`,
    });
    const decided = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consents',
      payload: { request: requestOf(url), ...decision },
    });
    return { preview, decided, redirect: new URL(String(decided.json().redirectUrl)) };
  }

  const transportFor = (provider: MemoryOAuthProvider, path: string) =>
    new StreamableHTTPClientTransport(new URL(`${base}/mcp${path}`), { authProvider: provider });

  /** Connects with saved tokens; the caller closes the client. */
  async function connect(provider: MemoryOAuthProvider, path = '') {
    const client = new Client({ name: 'oauth-tests', version: '1.0.0' });
    await client.connect(transportFor(provider, path));
    return client;
  }

  /** The client's first attempt: a 401, discovery, and the authorization URL it would open. */
  async function start(provider: MemoryOAuthProvider, path = '') {
    const transport = transportFor(provider, path);
    await expect(
      new Client({ name: 'oauth-tests', version: '1.0.0' }).connect(transport),
    ).rejects.toThrow(/Unauthorized/);
    return { transport, url: provider.authorizationUrl! };
  }

  /** The full sign-in: 401, discovery, consent, code exchange. */
  async function signIn(provider: MemoryOAuthProvider, path = '', decision = {}) {
    const { transport, url } = await start(provider, path);
    const { preview, decided, redirect } = await consent(url, { approve: true, ...decision });
    expect(decided.statusCode, decided.body).toBe(201);
    await transport.finishAuth(redirect.searchParams.get('code')!);
    return { preview: preview.json(), redirect, url };
  }

  /** A form post to the token or revocation endpoint, as a client sends it. */
  async function postForm(path: string, form: Record<string, string>) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
    };
  }

  /** A raw MCP request with a bearer token. */
  const listTools = (path: string, token: string) =>
    fetch(`${base}/mcp${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

  return { consent, connect, start, signIn, postForm, listTools };
}
