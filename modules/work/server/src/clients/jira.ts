import { createRestClient, type RestClientOptions } from '@bemmoly/core';
import type {
  JiraAttachment,
  JiraBoard,
  JiraBoardColumn,
  JiraComment,
  JiraComponent,
  JiraDeployment,
  JiraField,
  JiraIssuePage,
  JiraProject,
  JiraSprint,
  JiraTypeStatuses,
  JiraUser,
  JiraVersion,
} from './jira-types.ts';

export type * from './jira-types.ts';

/*
 * Jira's REST APIs: Cloud (v3, an API token with the account's email) and Data Center (v2, a
 * personal access token). Every call has a timeout and backs off on 429 and 503 through the
 * kernel's REST client; pages are walked here so callers see whole lists or cursors.
 */

export interface JiraClientOptions {
  baseUrl: string;
  deployment: JiraDeployment;
  email?: string;
  token: string;
  fetch: typeof fetch;
  signal?: AbortSignal;
  /** Tests make backoff instant. */
  sleep?: RestClientOptions['sleep'];
  timeoutMs?: number;
}

export const ISSUE_PAGE_SIZE = 100;
const PAGE = 50;

interface Paged<T> {
  values?: T[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
  total?: number;
}

export function createJiraClient(options: JiraClientOptions) {
  const cloud = options.deployment === 'cloud';
  const api = cloud ? 'rest/api/3' : 'rest/api/2';
  const authorization = cloud
    ? `Basic ${Buffer.from(`${options.email ?? ''}:${options.token}`).toString('base64')}`
    : `Bearer ${options.token}`;
  const rest = createRestClient({
    baseUrl: options.baseUrl,
    headers: { authorization },
    fetch: options.fetch,
    timeoutMs: options.timeoutMs ?? 30_000,
    maxBytes: 50 << 20,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });

  /** Walks a startAt/isLast paged list to the end. */
  async function all<T>(path: string, query: Record<string, string | number> = {}) {
    const items: T[] = [];
    for (let startAt = 0; ;) {
      const page = await rest.getJson<Paged<T> | T[]>(path, {
        ...query,
        startAt,
        maxResults: PAGE,
      });
      if (Array.isArray(page)) return [...items, ...page];
      const values = page.values ?? [];
      items.push(...values);
      const total = page.total ?? Number.POSITIVE_INFINITY;
      if (page.isLast || values.length === 0 || items.length >= total) return items;
      startAt += values.length;
    }
  }

  return {
    deployment: options.deployment,
    myself: () => rest.getJson<JiraUser>(`${api}/myself`),
    serverInfo: () =>
      rest.getJson<{ baseUrl?: string; version?: string; deploymentType?: string }>(
        `${api}/serverInfo`,
      ),
    /**
     * Every project the token lists. On Cloud `browse` narrows the list to projects whose
     * issues it can read; the default lists those it can merely see.
     */
    projects: (action?: 'browse') =>
      cloud
        ? all<JiraProject>(`${api}/project/search`, {
            expand: 'description,lead',
            ...(action ? { action } : {}),
          })
        : rest.getJson<JiraProject[]>(`${api}/project`, { expand: 'description,lead' }),
    /**
     * Issue totals for up to 50 projects in one call, from Cloud's expand=insight. Jira marks
     * insight experimental, so a project without it is counted another way by the caller.
     */
    async insightCounts(keys: readonly string[]): Promise<Map<string, number>> {
      const found = new Map<string, number>();
      if (!cloud || !keys.length) return found;
      const page = await rest.getJson<Paged<JiraProject>>(`${api}/project/search`, {
        keys: [...keys],
        expand: 'insight',
        maxResults: 50,
      });
      for (const project of page.values ?? []) {
        const total = project.insight?.totalIssueCount;
        if (typeof total === 'number' && total >= 0) found.set(project.key, total);
      }
      return found;
    },
    project: (key: string) =>
      rest.getJson<JiraProject>(`${api}/project/${encodeURIComponent(key)}`, {
        expand: 'description,lead,issueTypes',
      }),
    statuses: (key: string) =>
      rest.getJson<JiraTypeStatuses[]>(`${api}/project/${encodeURIComponent(key)}/statuses`),
    fields: () => rest.getJson<JiraField[]>(`${api}/field`),
    /** People who can be assigned issues in a project: who the plan's people pass lists. */
    assignable: (key: string) =>
      rest.getJson<JiraUser[]>(`${api}/user/assignable/search`, { project: key, maxResults: 1000 }),
    versions: (key: string) =>
      rest.getJson<JiraVersion[]>(`${api}/project/${encodeURIComponent(key)}/versions`),
    components: (key: string) =>
      rest.getJson<JiraComponent[]>(`${api}/project/${encodeURIComponent(key)}/components`),

    /** Issues in a project, oldest first; Cloud pages by token, Data Center by offset. */
    async countIssues(jql: string): Promise<number> {
      if (cloud) {
        const { count } = await rest.postJson<{ count?: number }>(
          `${api}/search/approximate-count`,
          { jql },
        );
        return count ?? 0;
      }
      const page = await rest.getJson<{ total?: number }>(`${api}/search`, { jql, maxResults: 0 });
      return page.total ?? 0;
    },

    async searchIssues(jql: string, cursor: string | null): Promise<JiraIssuePage> {
      if (cloud) {
        const page = await rest.getJson<{
          issues?: JiraIssuePage['issues'];
          nextPageToken?: string;
          isLast?: boolean;
        }>(`${api}/search/jql`, {
          jql,
          maxResults: ISSUE_PAGE_SIZE,
          fields: '*all',
          ...(cursor ? { nextPageToken: cursor } : {}),
        });
        const issues = page.issues ?? [];
        const next = page.isLast === false && page.nextPageToken ? page.nextPageToken : null;
        return { issues, next };
      }
      const startAt = cursor ? Number(cursor) : 0;
      const page = await rest.getJson<{ issues?: JiraIssuePage['issues']; total?: number }>(
        `${api}/search`,
        { jql, startAt, maxResults: ISSUE_PAGE_SIZE, fields: '*all' },
      );
      const issues = page.issues ?? [];
      const reached = startAt + issues.length;
      return {
        issues,
        next: issues.length && reached < (page.total ?? 0) ? String(reached) : null,
      };
    },

    /** Every comment of an issue, for issues whose embedded list was cut short. */
    comments: async (key: string) => {
      const items: JiraComment[] = [];
      for (let startAt = 0; ;) {
        const page = await rest.getJson<{ comments?: JiraComment[]; total?: number }>(
          `${api}/issue/${encodeURIComponent(key)}/comment`,
          { startAt, maxResults: 100 },
        );
        const values = page.comments ?? [];
        items.push(...values);
        if (!values.length || items.length >= (page.total ?? 0)) return items;
        startAt += values.length;
      }
    },

    download: (attachment: JiraAttachment) =>
      rest.getBytes(attachment.content ?? `${api}/attachment/content/${attachment.id}`),

    boards: (projectKey: string) =>
      all<JiraBoard>('rest/agile/1.0/board', { projectKeyOrId: projectKey }),
    async boardColumns(boardId: number): Promise<JiraBoardColumn[]> {
      const config = await rest.getJson<{ columnConfig?: { columns?: JiraBoardColumn[] } }>(
        `rest/agile/1.0/board/${boardId}/configuration`,
      );
      return config.columnConfig?.columns ?? [];
    },
    sprints: (boardId: number) => all<JiraSprint>(`rest/agile/1.0/board/${boardId}/sprint`),
  };
}

export type JiraClient = ReturnType<typeof createJiraClient>;
