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
  type HostRepository,
} from '../types.ts';
import { parseGithubEvents } from './github-delivery-events.ts';
import { githubPullSchema, parseGithubEvent, pullActivity } from './github-events.ts';
import { githubWrites } from './github-writes.ts';

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

const tokenSchema = z.object({ token: z.string(), expires_at: z.string().optional() });
const installationRepositoriesSchema = z.object({
  total_count: z.number().int(),
  repositories: z.array(
    z.object({
      full_name: z.string(),
      default_branch: z.string().nullish(),
      html_url: z.string().nullish(),
      archived: z.boolean().optional(),
    }),
  ),
});
/** GitHub's largest page; 50 of them reads an installation of 5,000 repositories. */
const REPOSITORY_PAGE = 100;
const REPOSITORY_PAGES = 50;
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

  /** What the app's installation covers, whether it was given all repositories or a list. */
  async function listRepositories(): Promise<HostRepository[]> {
    const client = rest(await bearer());
    const found: HostRepository[] = [];
    for (let page = 1; page <= REPOSITORY_PAGES; page += 1) {
      const answer = installationRepositoriesSchema.parse(
        await client.getJson('installation/repositories', { per_page: REPOSITORY_PAGE, page }),
      );
      for (const repository of answer.repositories) {
        if (repository.archived) continue;
        found.push({
          fullName: repository.full_name,
          defaultBranch: repository.default_branch ?? null,
          url: repository.html_url ?? null,
        });
      }
      const read = (page - 1) * REPOSITORY_PAGE + answer.repositories.length;
      if (answer.repositories.length < REPOSITORY_PAGE || read >= answer.total_count) break;
    }
    return found;
  }

  /** An installation token narrowed to reading one repository, never the cached one. */
  async function readToken(repository: string) {
    const name = repository.split('/').pop() ?? repository;
    const answer = tokenSchema.parse(
      await rest(`Bearer ${appJwt()}`).postJson(
        `app/installations/${encodeURIComponent(installationId ?? '')}/access_tokens`,
        { repositories: [name], permissions: { contents: 'read' } },
      ),
    );
    return {
      username: 'x-access-token',
      token: answer.token,
      expiresAt: answer.expires_at ?? null,
    };
  }

  return {
    ...githubWrites(async () => rest(await bearer())),
    // A token sees every repository its owner can; only the ones named on it are Bemmoly's.
    ...(connection.authMode === 'app' ? { listRepositories, readToken } : {}),
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
    const now = new Date().toISOString();
    return {
      ...parseGithubEvent(event, request.body, now),
      events: parseGithubEvents(event, request.body, now),
    };
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
