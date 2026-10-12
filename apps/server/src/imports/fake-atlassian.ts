import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { jira } from './fake-jira.ts';
import {
  FIXTURE_EMAIL,
  FIXTURE_TOKEN,
  load,
  page,
  type Answer,
  type FakeSiteOptions,
  type Lists,
} from './fake-shared.ts';

/*
 * A local stand-in for a Jira or Confluence site, serving the hand-written fixtures in
 * ./fixtures (no real site's data) with the paging, auth and failure behaviour the importers
 * must cope with: page cursors, a 303 to a media host for downloads, a 429 with Retry-After,
 * and failures switched on and off to prove a run resumes. Tests and the performance run
 * start one per site on an ephemeral loopback port.
 */

export {
  FIXTURE_EMAIL,
  FIXTURE_TOKEN,
  type FakeSiteKind,
  type FakeSiteOptions,
} from './fake-shared.ts';

export interface FakeSite {
  url: string;
  requests: string[];
  options: FakeSiteOptions;
  close(): Promise<void>;
}

/** The shape of fixtures/confluence/site.json. */
interface ConfluenceFixture {
  currentUser: unknown;
  spaces: unknown[];
  users: Record<string, unknown>;
  pages: Record<string, Record<string, unknown>[]>;
  comments: Lists;
  attachments: Lists;
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  site: string,
  headers: Record<string, string> = {},
) {
  const text = JSON.stringify(body ?? null).replaceAll('{{SITE}}', site);
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(text);
}

function confluence(options: FakeSiteOptions) {
  void options;
  const data = load<ConfluenceFixture>('confluence/site.json');
  return async (_req: IncomingMessage, url: URL): Promise<Answer> => {
    const path = url.pathname.replace(/^\/wiki/, '');
    const results = (items: unknown[]) => {
      const { start, values, isLast } = page(items, url, 2);
      return {
        results: values,
        start,
        size: values.length,
        _links: isLast ? {} : { next: `/rest/api/next?start=${start + values.length}` },
      };
    };
    if (path === '/rest/api/user/current') return [200, data.currentUser];
    if (path === '/rest/api/user')
      return [
        200,
        data.users[url.searchParams.get('accountId') ?? url.searchParams.get('key') ?? ''] ?? {},
      ];
    if (path === '/rest/api/space') return [200, results(data.spaces)];
    if (path === '/rest/api/search') {
      const key = /space = "([^"]+)"/.exec(url.searchParams.get('cql') ?? '')?.[1] ?? '';
      return [200, { results: [], totalSize: (data.pages[key] ?? []).length }];
    }
    if (path === '/rest/api/content') {
      const pages = data.pages[url.searchParams.get('spaceKey') ?? ''] ?? [];
      const withBody = (url.searchParams.get('expand') ?? '').includes('body.storage');
      return [200, results(withBody ? pages : pages.map(({ body: _body, ...rest }) => rest))];
    }
    const child = /^\/rest\/api\/content\/(\w+)\/child\/(attachment|comment)$/.exec(path);
    if (child)
      return [
        200,
        results(data[child[2] === 'comment' ? 'comments' : 'attachments'][child[1]!] ?? []),
      ];
    return [404, { message: `No route for ${path}` }];
  };
}

/** Starts a fake site on 127.0.0.1 with an ephemeral port. */
export async function startFakeSite(options: FakeSiteOptions): Promise<FakeSite> {
  const requests: string[] = [];
  const handle = options.kind === 'confluence' ? confluence(options) : jira(options.kind, options);
  const limited = new Set<string>();
  let origin = '';
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', origin);
    requests.push(`${req.method} ${url.pathname}`);
    const auth = req.headers.authorization ?? '';
    const media =
      url.pathname.startsWith('/media/') || url.pathname.includes('/download/attachments/');
    const expected =
      options.kind === 'jira-dc'
        ? `Bearer ${FIXTURE_TOKEN}`
        : `Basic ${Buffer.from(`${FIXTURE_EMAIL}:${FIXTURE_TOKEN}`).toString('base64')}`;
    if (!media && auth !== expected) return send(res, 401, { message: 'Unauthorized' }, origin);
    if (options.failWhen?.(url.pathname, url))
      return send(res, 500, { message: 'Planned failure' }, origin);
    if (options.rateLimitWhen?.(url.pathname, url))
      return send(res, 429, { message: 'Too many requests' }, origin, { 'retry-after': '0' });
    if (options.rateLimitOnce?.has(url.pathname) && !limited.has(url.pathname)) {
      limited.add(url.pathname);
      return send(res, 429, { message: 'Slow down' }, origin, { 'retry-after': '0' });
    }
    if (media) {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(
        Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.from('fakepng!'),
        ]),
      );
    }
    handle(req, url)
      .then(([status, body, headers]) => send(res, status, body, origin, headers))
      .catch((error: unknown) => send(res, 500, { message: String(error) }, origin));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: origin,
    requests,
    options,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
