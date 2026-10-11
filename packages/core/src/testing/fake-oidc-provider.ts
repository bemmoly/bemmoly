import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

/** The person the fake provider signs in, as its directory knows them. */
export interface FakeOidcUser {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  groups?: string[];
}

/** Ways the next ID token can be wrong, one per validation the client must make. */
export interface FakeOidcTampering {
  issuer?: string;
  audience?: string;
  /** Seconds from now; negative is already expired. */
  expiresIn?: number;
  nonce?: string;
  /** Sign with a key that is not in the provider's JWKS. */
  foreignKey?: boolean;
  /** The authorization endpoint answers with this OAuth error instead of a code. */
  authorizeError?: string;
}

export interface FakeOidcProvider {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Who signs in next; the authorization endpoint redirects straight back for them. */
  user: FakeOidcUser;
  tamper: FakeOidcTampering;
  /** Authorization requests received, newest last, for asserting PKCE and scopes. */
  authorizations: URLSearchParams[];
  /**
   * What the authorization endpoint would redirect to for this URL, without a browser or a
   * request: the code-bearing callback URL (or one carrying the tampered error).
   */
  authorize(url: string): string;
  stop(): Promise<void>;
}

interface PendingCode {
  clientId: string;
  redirectUri: string;
  challenge: string;
  nonce: string;
  user: FakeOidcUser;
  tamper: FakeOidcTampering;
}

async function readBody(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/**
 * A small OpenID provider for tests, on 127.0.0.1: discovery, JWKS, an authorization
 * endpoint that signs `user` in without a form, a token endpoint that checks the client
 * secret, redirect URI and PKCE verifier, and userinfo. Nothing leaves the machine.
 */
export async function startFakeOidcProvider(
  options: { port?: number; clientId?: string; clientSecret?: string } = {},
): Promise<FakeOidcProvider> {
  const keys = await generateKeyPair('RS256', { extractable: true });
  const foreign = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, PendingCode>();
  const accessTokens = new Map<string, FakeOidcUser>();
  const state: FakeOidcProvider = {
    issuer: '',
    clientId: options.clientId ?? 'bemmoly-test-client',
    clientSecret: options.clientSecret ?? randomBytes(16).toString('hex'),
    user: { sub: 'user-1', email: 'ada@acme.dev', emailVerified: true, name: 'Ada', groups: [] },
    tamper: {},
    authorizations: [],
    authorize: () => '',
    stop: async () => undefined,
  };

  async function idToken(code: PendingCode): Promise<string> {
    const { user, tamper } = code;
    const now = Math.floor(Date.now() / 1000);
    const key: CryptoKey = tamper.foreignKey ? foreign.privateKey : keys.privateKey;
    return new SignJWT({
      nonce: tamper.nonce ?? code.nonce,
      ...(user.email ? { email: user.email } : {}),
      ...(user.emailVerified === undefined ? {} : { email_verified: user.emailVerified }),
      ...(user.name ? { name: user.name } : {}),
      ...(user.groups ? { groups: user.groups } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(tamper.issuer ?? state.issuer)
      .setAudience(tamper.audience ?? code.clientId)
      .setSubject(user.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + (tamper.expiresIn ?? 300))
      .sign(key);
  }

  function redirectFor(url: URL): string {
    const params = url.searchParams;
    state.authorizations.push(params);
    const redirect = new URL(params.get('redirect_uri') ?? '');
    const stateParam = params.get('state');
    if (stateParam) redirect.searchParams.set('state', stateParam);
    if (state.tamper.authorizeError) {
      redirect.searchParams.set('error', state.tamper.authorizeError);
    } else {
      const code = randomBytes(16).toString('base64url');
      codes.set(code, {
        clientId: params.get('client_id') ?? '',
        redirectUri: params.get('redirect_uri') ?? '',
        challenge: params.get('code_challenge') ?? '',
        nonce: params.get('nonce') ?? '',
        user: { ...state.user },
        tamper: { ...state.tamper },
      });
      redirect.searchParams.set('code', code);
    }
    redirect.searchParams.set('iss', state.issuer);
    return redirect.href;
  }

  function authorize(url: URL, response: ServerResponse) {
    response.writeHead(302, { location: redirectFor(url) });
    response.end();
  }

  async function token(request: IncomingMessage, response: ServerResponse) {
    const body = await readBody(request);
    const code = codes.get(body.get('code') ?? '');
    codes.delete(body.get('code') ?? '');
    if (
      body.get('client_id') !== state.clientId ||
      body.get('client_secret') !== state.clientSecret
    ) {
      return json(response, 401, { error: 'invalid_client' });
    }
    if (
      !code ||
      code.redirectUri !== body.get('redirect_uri') ||
      s256(body.get('code_verifier') ?? '') !== code.challenge
    ) {
      return json(response, 400, { error: 'invalid_grant' });
    }
    const accessToken = randomBytes(16).toString('base64url');
    accessTokens.set(accessToken, code.user);
    return json(response, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 300,
      id_token: await idToken(code),
    });
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', state.issuer);
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /.well-known/openid-configuration') {
      return json(response, 200, {
        issuer: state.issuer,
        authorization_endpoint: `${state.issuer}/authorize`,
        token_endpoint: `${state.issuer}/token`,
        userinfo_endpoint: `${state.issuer}/userinfo`,
        jwks_uri: `${state.issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
      });
    }
    if (route === 'GET /jwks') return json(response, 200, { keys: [jwk] });
    if (route === 'GET /authorize') return authorize(url, response);
    if (route === 'POST /token') {
      token(request, response).catch(() => json(response, 500, { error: 'server_error' }));
      return;
    }
    if (route === 'GET /userinfo') {
      const user = accessTokens.get((request.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (!user) return json(response, 401, { error: 'invalid_token' });
      return json(response, 200, { sub: user.sub, email: user.email, groups: user.groups });
    }
    return json(response, 404, { error: 'not_found' });
  });
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
  state.issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  state.authorize = (url) => redirectFor(new URL(url));
  state.stop = () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  return state;
}
