import type { IncomingMessage } from 'node:http';
import {
  bodyOf,
  load,
  page,
  type Answer,
  type FakeSiteOptions,
  type Lists,
} from './fake-shared.ts';

/*
 * The Jira half of the fake site: Cloud (v3) and Data Center (v2) from the fixtures, or a
 * generated list of projects for a large site, with what the chooser reads: action=browse,
 * keys and expand=insight on project search, and approximate counts.
 */

/** The shape of a Jira fixture site.json. */
interface JiraFixture {
  myself: unknown;
  projects: { id: string; key: string }[];
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

const projectOf = (jql: string) => /project = "([^"]+)"/.exec(jql)?.[1] ?? '';

export function jira(kind: 'jira-cloud' | 'jira-dc', options: FakeSiteOptions) {
  const data = load<JiraFixture>(`${kind}/site.json`);
  const issues = (options.issues ??
    (kind === 'jira-cloud' ? load<unknown[]>('jira-cloud/issues.json') : data.issues) ??
    []) as { key: string }[];
  const comments: Lists = kind === 'jira-cloud' ? load<Lists>('jira-cloud/comments.json') : {};
  const api = kind === 'jira-cloud' ? '/rest/api/3' : '/rest/api/2';
  const inProject = (key: string) => issues.filter((issue) => issue.key.startsWith(`${key}-`));
  const pageSize = options.pageSize ?? 2;
  const projects = options.projects ?? data.projects;
  const total = (key: string) => options.issueCounts?.[key] ?? inProject(key).length;
  /** project/search: action=browse drops the unbrowsable, keys narrows, insight adds totals. */
  const search = (url: URL) => {
    const keys = url.searchParams.getAll('keys');
    const listed = projects.filter(
      (project) =>
        (url.searchParams.get('action') !== 'browse' || !options.unbrowsable?.has(project.id)) &&
        (!keys.length || keys.includes(project.key)),
    );
    const insight =
      !options.noInsight && (url.searchParams.get('expand') ?? '').includes('insight');
    const { values, isLast } = page(listed, url);
    return {
      values: insight
        ? values.map((project) => ({
            ...project,
            insight: { totalIssueCount: total(project.key) },
          }))
        : values,
      isLast,
    };
  };
  return async (req: IncomingMessage, url: URL): Promise<Answer> => {
    const path = url.pathname;
    if (path === `${api}/myself`) return [200, data.myself];
    if (path === `${api}/project/search`) return [200, search(url)];
    if (path === `${api}/project`) return [200, projects];
    const projectPath = new RegExp(
      `^${api}/project/([^/]+)(/statuses|/versions|/components)?$`,
    ).exec(path);
    if (projectPath) {
      const key = decodeURIComponent(projectPath[1]!);
      const part = projectPath[2];
      // A generated project takes the first fixture project's configuration.
      const listed = projects.find((project) => project.key === key);
      const template = Object.keys(data.project)[0] ?? '';
      const own = (data.project[key] ?? null) as Record<string, unknown> | null;
      if (!part) {
        if (own) return [200, own];
        return listed
          ? [200, { ...(data.project[template] as object), ...listed }]
          : [404, { errorMessages: ['No project'] }];
      }
      const lists = data[part.slice(1) as 'statuses' | 'versions' | 'components'];
      return [200, lists[key] ?? (listed && part === '/statuses' ? lists[template] : []) ?? []];
    }
    if (path === `${api}/field`) return [200, data.fields];
    if (path === `${api}/search/approximate-count`) {
      const body = await bodyOf(req);
      return [200, { count: total(projectOf(body?.jql ?? '')) }];
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
        return [200, { total: total(projectOf(url.searchParams.get('jql') ?? '')), issues: [] }];
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
