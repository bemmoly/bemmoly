import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/*
 * A local stand-in for a Jira or Confluence site, serving the hand-written fixtures in
 * ./fixtures (no real site's data) with the paging, auth and failure behaviour the importers
 * must cope with: page cursors, a 303 to a media host for downloads, a 429 with Retry-After,
 * and failures switched on and off to prove a run resumes. Tests and the performance run
 * start one per site on an ephemeral loopback port.
 */

export type FakeSiteKind = 'jira-cloud' | 'jira-dc' | 'confluence';

export const FIXTURE_EMAIL = 'rohan@acmelabs.dev';
/** Not a credential anywhere: the fake site accepts only this string. */
export const FIXTURE_TOKEN = 'fixture-token-not-a-real-secret';

export interface FakeSiteOptions {
  kind: FakeSiteKind;
  /** Issues per search page; small by default so paging is exercised. */
  pageSize?: number;
  /** Replaces the fixture issues, for the performance run. */
  issues?: unknown[];
  /** Answers 500 while it returns true. */
  failWhen?: (path: string, url: URL) => boolean;
  /** Paths answered once with 429 and Retry-After: 0. */
  rateLimitOnce?: Set<string>;
}

export interface FakeSite {
  url: string;
  requests: string[];
  options: FakeSiteOptions;
  close(): Promise<void>;
}

type Lists = Record<string, unknown[]>;

/** The shape of a Jira fixture site.json. */
interface JiraFixture {
  myself: unknown;
  projects: unknown[];
  project: Record<string, unknown>;
  statuses: Lists;
  fields: unknown[];
  versions: Lists;
  components: Lists;
  boards: Lists;
  boardColumns: Lists;
  sprints: Lists;
  issues?: { key: string }[];
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

const load = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')) as T;

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

const projectOf = (jql: string) => /project = "([^"]+)"/.exec(jql)?.[1] ?? '';

function page<T>(items: T[], url: URL, size = 50) {
  const start = Number(url.searchParams.get('startAt') ?? url.searchParams.get('start') ?? 0);
  const limit = Math.min(
    size,
    Number(url.searchParams.get('maxResults') ?? url.searchParams.get('limit') ?? size),
  );
  const values = items.slice(start, start + limit);
  return { start, values, isLast: start + values.length >= items.length };
}

async function bodyOf(req: IncomingMessage): Promise<{ jql?: string } | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length
    ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { jql?: string })
    : null;
}

function jira(kind: 'jira-cloud' | 'jira-dc', options: FakeSiteOptions) {
  const data = load<JiraFixture>(`${kind}/site.json`);
  const issues = (options.issues ??
    (kind === 'jira-cloud' ? load<unknown[]>('jira-cloud/issues.json') : data.issues) ??
    []) as { key: string }[];
  const comments: Lists = kind === 'jira-cloud' ? load<Lists>('jira-cloud/comments.json') : {};
  const api = kind === 'jira-cloud' ? '/rest/api/3' : '/rest/api/2';
  const inProject = (key: string) => issues.filter((issue) => issue.key.startsWith(`${key}-`));
  const pageSize = options.pageSize ?? 2;
  return async (
    req: IncomingMessage,
    url: URL,
  ): Promise<[number, unknown, Record<string, string>?]> => {
    const path = url.pathname;
    if (path === `${api}/myself`) return [200, data.myself];
    if (path === `${api}/project/search`) {
      const { values, isLast } = page(data.projects, url);
      return [200, { values, isLast }];
    }
    if (path === `${api}/project`) return [200, data.projects];
    const projectPath = new RegExp(
      `^${api}/project/([^/]+)(/statuses|/versions|/components)?$`,
    ).exec(path);
    if (projectPath) {
      const key = decodeURIComponent(projectPath[1]!);
      const part = projectPath[2];
      if (!part) {
        return data.project[key]
          ? [200, data.project[key]]
          : [404, { errorMessages: ['No project'] }];
      }
      return [200, data[part.slice(1) as 'statuses' | 'versions' | 'components'][key] ?? []];
    }
    if (path === `${api}/field`) return [200, data.fields];
    if (path === `${api}/search/approximate-count`) {
      const body = await bodyOf(req);
      return [200, { count: inProject(projectOf(body?.jql ?? '')).length }];
    }
    if (path === `${api}/search/jql`) {
      const list = inProject(projectOf(url.searchParams.get('jql') ?? ''));
      const start = Number(url.searchParams.get('nextPageToken') ?? 0);
      const values = list.slice(start, start + pageSize);
      const next = start + values.length;
      return [
        200,
        {
          issues: values,
          isLast: next >= list.length,
          ...(next < list.length ? { nextPageToken: String(next) } : {}),
        },
      ];
    }
    if (path === `${api}/search`) {
      const list = inProject(projectOf(url.searchParams.get('jql') ?? ''));
      if (url.searchParams.get('maxResults') === '0')
        return [200, { total: list.length, issues: [] }];
      const start = Number(url.searchParams.get('startAt') ?? 0);
      return [
        200,
        { startAt: start, total: list.length, issues: list.slice(start, start + pageSize) },
      ];
    }
    const comment = new RegExp(`^${api}/issue/([^/]+)/comment$`).exec(path);
    if (comment) {
      const all = comments[decodeURIComponent(comment[1]!)] ?? [];
      const start = Number(url.searchParams.get('startAt') ?? 0);
      return [200, { startAt: start, total: all.length, comments: all.slice(start, start + 2) }];
    }
    const content = new RegExp(`^${api}/attachment/content/(\\w+)$`).exec(path);
    if (content) return [303, null, { location: `/media/${content[1]}` }];
    if (path === '/rest/agile/1.0/board') {
      const { values, isLast } = page(
        data.boards[url.searchParams.get('projectKeyOrId') ?? ''] ?? [],
        url,
      );
      return [200, { values, isLast }];
    }
    const board = /^\/rest\/agile\/1\.0\/board\/(\d+)\/(configuration|sprint)$/.exec(path);
    if (board) {
      if (board[2] === 'configuration')
        return [200, { columnConfig: { columns: data.boardColumns[board[1]!] ?? [] } }];
      const sprints = data.sprints[board[1]!];
      if (!sprints) return [400, { errorMessages: ['The board does not support sprints'] }];
      const { values, isLast } = page(sprints, url);
      return [200, { values, isLast }];
    }
    return [404, { errorMessages: [`No route for ${path}`] }];
  };
}

function confluence(options: FakeSiteOptions) {
  void options;
  const data = load<ConfluenceFixture>('confluence/site.json');
  return async (
    _req: IncomingMessage,
    url: URL,
  ): Promise<[number, unknown, Record<string, string>?]> => {
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
    if (options.rateLimitOnce?.has(url.pathname) && !limited.has(url.pathname)) {
      limited.add(url.pathname);
      return send(res, 429, { message: 'Slow down' }, origin, { 'retry-after': '0' });
    }
    if (media) {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(Buffer.from('fake-png-bytes-0'));
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
