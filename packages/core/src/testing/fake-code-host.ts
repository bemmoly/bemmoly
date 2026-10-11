import { generateKeyPairSync } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { codeHostFixture } from './code-host-deliveries.ts';

/*
 * A local stand-in for the GitHub (Enterprise Server) and GitLab APIs, serving what backfill
 * and the connection test read: who the token is, and a repository's recent pull or merge
 * requests, built from the hand-written webhook fixtures. It never reaches a real host.
 */

export const FAKE_CODE_HOST_TOKEN = 'fake-code-host-token-0001';

/** The GitHub App the fake creates from a manifest: the code to convert and what it makes. */
export const FAKE_GITHUB_APP = {
  code: 'fake-manifest-code-0001',
  id: 4242,
  slug: 'bemmoly-test',
  installationId: '777',
  webhookSecret: 'fake-github-app-webhook-secret',
} as const;

export interface FakeCodeHost {
  /** The base URL an integration saves, as for Enterprise Server or self-managed GitLab. */
  url: string;
  /** Paths requested, in order, for assertions. */
  requests: string[];
  close(): Promise<void>;
}

export interface FakeCodeHostOptions {
  /** Text swapped into the served requests, e.g. { 'ACME-1': 'DEV-7' }. */
  replace?: Readonly<Record<string, string>>;
  /** The first request to these paths answers as a spent rate limit. */
  rateLimitOnce?: ReadonlySet<string>;
}

function send(response: ServerResponse, status: number, body: unknown, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

/** A JWT signed as the fake app: its issuer is the app's id. The signature is not checked. */
function appIssuer(request: IncomingMessage): string | null {
  const token = /^Bearer (ey[^.]+\.([^.]+)\.[^.]+)$/.exec(request.headers.authorization ?? '');
  if (!token?.[2]) return null;
  const claims = JSON.parse(Buffer.from(token[2], 'base64url').toString()) as { iss?: string };
  return claims.iss ?? null;
}

/** The fake GitHub's app endpoints: manifest conversion, the app, its installation. */
function githubAppAnswer(request: IncomingMessage, path: string, pem: string) {
  const app = FAKE_GITHUB_APP;
  if (request.method === 'POST' && path.startsWith('/api/v3/app-manifests/')) {
    return path === `/api/v3/app-manifests/${app.code}/conversions`
      ? {
          status: 201,
          body: { id: app.id, slug: app.slug, pem, webhook_secret: app.webhookSecret },
        }
      : { status: 404, body: { message: 'Not Found' } };
  }
  if (!path.startsWith('/api/v3/app')) return null;
  if (appIssuer(request) !== String(app.id)) return { status: 401, body: { message: 'Bad JWT' } };
  if (path === '/api/v3/app') return { status: 200, body: { name: 'Bemmoly test' } };
  if (path === `/api/v3/app/installations/${app.installationId}`) {
    return { status: 200, body: { id: Number(app.installationId), app_id: app.id } };
  }
  if (path === `/api/v3/app/installations/${app.installationId}/access_tokens`) {
    return { status: 201, body: { token: FAKE_CODE_HOST_TOKEN } };
  }
  return { status: 404, body: { message: 'Not Found' } };
}

const authorised = (request: IncomingMessage) =>
  request.headers.authorization === `Bearer ${FAKE_CODE_HOST_TOKEN}` ||
  request.headers['private-token'] === FAKE_CODE_HOST_TOKEN;

export async function startFakeCodeHost(options: FakeCodeHostOptions = {}): Promise<FakeCodeHost> {
  const requests: string[] = [];
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const limited = new Set(options.rateLimitOnce ?? []);
  // Served as changed just now, so a backfill window always includes them.
  const githubPull = () => ({
    ...JSON.parse(codeHostFixture('github', 'pull_request.opened', options.replace)).pull_request,
    updated_at: new Date().toISOString(),
  });
  const gitlabRequest = () => {
    const attributes = JSON.parse(
      codeHostFixture('gitlab', 'merge_request.open', options.replace),
    ).object_attributes;
    return {
      ...attributes,
      web_url: attributes.url,
      author: { username: 'jonas.m' },
      updated_at: new Date().toISOString(),
    };
  };

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://fake').pathname;
    requests.push(`${request.method} ${path}`);
    if (limited.delete(path)) {
      const reset = Math.ceil(Date.now() / 1000) + 1;
      return send(
        response,
        403,
        { message: 'API rate limit exceeded' },
        {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(reset),
        },
      );
    }
    const appAnswer = githubAppAnswer(request, path, pem);
    if (appAnswer) return send(response, appAnswer.status, appAnswer.body);
    if (!authorised(request)) return send(response, 401, { message: 'Bad credentials' });
    if (path === '/api/v3/installation/repositories') {
      return send(response, 200, { total_count: 1, repositories: [{ full_name: 'acme/api' }] });
    }
    if (path === '/api/v3/user') return send(response, 200, { login: 'bemmoly-bot' });
    if (path === '/api/v4/user') return send(response, 200, { username: 'project_2048_bot' });
    if (/^\/api\/v3\/repos\/[^/]+\/[^/]+\/pulls$/.test(path)) {
      return send(response, 200, [githubPull()]);
    }
    if (/^\/api\/v4\/projects\/[^/]+\/merge_requests$/.test(path)) {
      return send(response, 200, [gitlabRequest()]);
    }
    return send(response, 404, { message: 'Not Found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
