import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { codeHostFixture } from './code-host-deliveries.ts';

/*
 * A local stand-in for the GitHub (Enterprise Server) and GitLab APIs, serving what backfill
 * and the connection test read: who the token is, and a repository's recent pull or merge
 * requests, built from the hand-written webhook fixtures. It never reaches a real host.
 */

export const FAKE_CODE_HOST_TOKEN = 'fake-code-host-token-0001';

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

const authorised = (request: IncomingMessage) =>
  request.headers.authorization === `Bearer ${FAKE_CODE_HOST_TOKEN}` ||
  request.headers['private-token'] === FAKE_CODE_HOST_TOKEN;

export async function startFakeCodeHost(options: FakeCodeHostOptions = {}): Promise<FakeCodeHost> {
  const requests: string[] = [];
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
    if (!authorised(request)) return send(response, 401, { message: 'Bad credentials' });
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
