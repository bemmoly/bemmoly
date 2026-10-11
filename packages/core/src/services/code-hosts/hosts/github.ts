import { createSign, randomUUID } from 'node:crypto';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { createCodeHostRest } from '../../../clients/code-host-rest.ts';
import { bodyDigest, hmacSha256Hex, safeEqual } from '../signature.ts';
import {
  headerOf,
  withoutTrailingSlashes,
  type CodeHostDriver,
  type HostApiOptions,
  type HostConnection,
} from '../types.ts';
import { githubPullSchema, parseGithubEvent, pullActivity } from './github-events.ts';

/*
 * GitHub, on github.com and on Enterprise Server. Deliveries are signed with HMAC-SHA256 of
 * the raw body under the webhook secret (X-Hub-Signature-256). The API is called as a GitHub
 * App (a short-lived JWT exchanged for an installation token) or with a token.
 */

const SIGNATURE_PREFIX = 'sha256=';
const API_VERSION = '2022-11-28';
/** GitHub accepts an app JWT for at most ten minutes; issued a minute back for clock skew. */
const JWT_LIFETIME_SECONDS = 9 * 60;

export function githubApiUrl(baseUrl: string | null): string {
  return baseUrl ? `${withoutTrailingSlashes(baseUrl)}/api/v3` : 'https://api.github.com';
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** The RS256 JWT a GitHub App signs with its private key to ask for an installation token. */
export function githubAppJwt(appId: string, privateKey: string, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + JWT_LIFETIME_SECONDS, iss: appId }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${base64url(signer.sign(privateKey))}`;
}

const tokenSchema = z.object({ token: z.string() });
const userSchema = z.object({ login: z.string() });
const appSchema = z.object({ name: z.string() });

function githubApi(connection: HostConnection, options: HostApiOptions) {
  const baseUrl = githubApiUrl(connection.baseUrl);
  const rest = (authorization: string) =>
    createCodeHostRest({
      ...options,
      baseUrl,
      headers: {
        authorization,
        'x-github-api-version': API_VERSION,
        'user-agent': 'Bemmoly',
      },
    });
  const { appId, installationId, secrets } = connection;
  const appJwt = () => {
    if (!appId || !secrets.privateKey)
      throw new ValidationError('The GitHub App has no private key');
    return githubAppJwt(appId, secrets.privateKey, Math.floor(Date.now() / 1000));
  };

  let installationToken: Promise<string> | null = null;
  async function bearer(): Promise<string> {
    if (connection.authMode === 'token') {
      if (!secrets.token) throw new ValidationError('No access token is saved for this host');
      return `Bearer ${secrets.token}`;
    }
    installationToken ??= rest(`Bearer ${appJwt()}`)
      .postJson(`app/installations/${encodeURIComponent(installationId ?? '')}/access_tokens`, {})
      .then((answer) => tokenSchema.parse(answer).token);
    return `Bearer ${await installationToken}`;
  }

  return {
    async check() {
      if (connection.authMode === 'app') {
        const app = appSchema.parse(await rest(`Bearer ${appJwt()}`).getJson('app'));
        await bearer();
        return `Connected as the ${app.name} app`;
      }
      const user = userSchema.parse(await rest(await bearer()).getJson('user'));
      return `Connected as ${user.login}`;
    },
    async recentRequests(repository: string, since: Date, limit: number) {
      const pulls = z.array(githubPullSchema).parse(
        await rest(await bearer()).getJson(`repos/${repository}/pulls`, {
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: Math.min(100, limit),
        }),
      );
      return pulls
        .filter((pull) => Date.parse(pull.updated_at) >= since.getTime())
        .map((pull) => pullActivity(repository, pull));
    },
  };
}

export const githubHost: CodeHostDriver = {
  kind: 'github',
  label: 'GitHub',
  cloudUrl: 'https://github.com',
  verify(request, webhookSecret) {
    const presented = headerOf(request, 'x-hub-signature-256') ?? '';
    if (!webhookSecret || !presented.startsWith(SIGNATURE_PREFIX)) return false;
    return safeEqual(presented, `${SIGNATURE_PREFIX}${hmacSha256Hex(webhookSecret, request.body)}`);
  },
  deliveryId: (request) => headerOf(request, 'x-github-delivery') ?? bodyDigest(request.body),
  parse(request) {
    const event = headerOf(request, 'x-github-event');
    if (!event) throw new ValidationError('The delivery does not name a GitHub event');
    if (event === 'ping') {
      return { event, action: null, summary: 'Ping from GitHub', activities: [], ping: true };
    }
    return parseGithubEvent(event, request.body, new Date().toISOString());
  },
  ping(webhookSecret) {
    const body = Buffer.from(JSON.stringify({ zen: 'Bemmoly test delivery', hook_id: 0 }));
    return {
      body,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'ping',
        'x-github-delivery': `test-${randomUUID()}`,
        'x-hub-signature-256': `${SIGNATURE_PREFIX}${hmacSha256Hex(webhookSecret, body)}`,
      },
    };
  },
  api: githubApi,
};
