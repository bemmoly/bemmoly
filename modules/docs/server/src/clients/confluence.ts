import { createRestClient, type RestClientOptions } from '@bemmoly/core';

/*
 * Confluence's REST API, the content endpoints Cloud (under /wiki) and Data Center share:
 * spaces, pages with their storage-format bodies, ancestors and labels, attachments, comments
 * and people. Cloud authenticates with an API token and the account email, Data Center with a
 * personal access token. Timeouts and Retry-After backoff come from the kernel REST client.
 */

export type ConfluenceDeployment = 'cloud' | 'datacenter';

export interface ConfluenceClientOptions {
  baseUrl: string;
  deployment: ConfluenceDeployment;
  email?: string;
  token: string;
  fetch: typeof fetch;
  signal?: AbortSignal;
  sleep?: RestClientOptions['sleep'];
}

export interface ConfluenceUser {
  accountId?: string;
  userKey?: string;
  username?: string;
  email?: string;
  displayName?: string;
  publicName?: string;
}

export interface ConfluenceSpace {
  id: number | string;
  key: string;
  name: string;
  type?: string;
  description?: { plain?: { value?: string } };
}

export interface ConfluencePage {
  id: string;
  title: string;
  status?: string;
  ancestors?: { id: string }[];
  version?: { number?: number; when?: string; by?: ConfluenceUser };
  history?: { createdBy?: ConfluenceUser; createdDate?: string };
  body?: { storage?: { value?: string } };
  metadata?: { labels?: { results?: { name: string }[] } };
}

export interface ConfluenceAttachment {
  id: string;
  title: string;
  metadata?: { mediaType?: string };
  extensions?: { mediaType?: string; fileSize?: number };
  _links?: { download?: string };
}

export interface ConfluenceComment {
  id: string;
  ancestors?: { id: string; type?: string }[];
  body?: { storage?: { value?: string } };
  history?: { createdBy?: ConfluenceUser; createdDate?: string };
  extensions?: { location?: string };
}

interface Results<T> {
  results?: T[];
  size?: number;
  totalSize?: number;
  _links?: { next?: string };
}

const LIMIT = 50;

export function createConfluenceClient(options: ConfluenceClientOptions) {
  const cloud = options.deployment === 'cloud';
  const root =
    cloud && !/\/wiki$/.test(options.baseUrl) ? `${options.baseUrl}/wiki` : options.baseUrl;
  const authorization = cloud
    ? `Basic ${Buffer.from(`${options.email ?? ''}:${options.token}`).toString('base64')}`
    : `Bearer ${options.token}`;
  const rest = createRestClient({
    baseUrl: root,
    headers: { authorization },
    fetch: options.fetch,
    timeoutMs: 30_000,
    maxBytes: 50 << 20,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });

  /** Walks a start/limit list to the end. */
  async function all<T>(path: string, query: Record<string, string | number> = {}): Promise<T[]> {
    const items: T[] = [];
    for (let start = 0; ;) {
      const page = await rest.getJson<Results<T>>(path, { ...query, start, limit: LIMIT });
      const values = page.results ?? [];
      items.push(...values);
      if (!values.length || !page._links?.next) return items;
      start += values.length;
    }
  }

  return {
    root,
    currentUser: () => rest.getJson<ConfluenceUser>('rest/api/user/current'),
    /** Team (global) and personal spaces; the chooser leaves personal ones unticked. */
    spaces: () => all<ConfluenceSpace>('rest/api/space', { expand: 'description.plain' }),
    async countPages(spaceKey: string): Promise<number> {
      const page = await rest.getJson<Results<unknown>>('rest/api/search', {
        cql: `space = "${spaceKey.replace(/[\\"]/g, '\\$&')}" and type = page`,
        limit: 0,
      });
      return page.totalSize ?? page.size ?? 0;
    },
    /** One page of a space's current pages; with bodies when asked. */
    async pages(spaceKey: string, start: number, withBody: boolean) {
      const page = await rest.getJson<Results<ConfluencePage>>('rest/api/content', {
        spaceKey,
        type: 'page',
        status: 'current',
        start,
        limit: LIMIT,
        expand: withBody
          ? 'ancestors,version,history,body.storage,metadata.labels'
          : 'ancestors,version',
      });
      const results = page.results ?? [];
      return { results, next: page._links?.next && results.length ? start + results.length : null };
    },
    attachments: (pageId: string) =>
      all<ConfluenceAttachment>(`rest/api/content/${encodeURIComponent(pageId)}/child/attachment`),
    comments: (pageId: string) =>
      all<ConfluenceComment>(`rest/api/content/${encodeURIComponent(pageId)}/child/comment`, {
        expand: 'body.storage,history,ancestors,extensions.location',
        depth: 'all',
      }),
    /**
     * The site's people, up to `limit`: Cloud searches users by CQL, Data Center lists the
     * confluence-users group.
     */
    async people(limit: number): Promise<ConfluenceUser[]> {
      if (cloud) {
        const found = await all<{ user?: ConfluenceUser }>('rest/api/search/user', {
          cql: 'type=user',
        });
        return found.flatMap((hit) => (hit.user ? [hit.user] : [])).slice(0, limit);
      }
      return (await all<ConfluenceUser>('rest/api/group/confluence-users/member')).slice(0, limit);
    },
    /** A page's versions: number, when and by whom (the current one included). */
    versions: (pageId: string) =>
      all<{ number: number; when?: string; by?: ConfluenceUser }>(
        `rest/api/content/${encodeURIComponent(pageId)}/version`,
      ),
    /** One earlier version of a page, with its body. */
    historical: (pageId: string, version: number) =>
      rest.getJson<ConfluencePage>(`rest/api/content/${encodeURIComponent(pageId)}`, {
        status: 'historical',
        version,
        expand: 'body.storage,version',
      }),
    user: (id: string) =>
      rest.getJson<ConfluenceUser>('rest/api/user', cloud ? { accountId: id } : { key: id }),
    download: (attachment: ConfluenceAttachment) =>
      rest.getBytes(
        attachment._links?.download ??
          `rest/api/content/${encodeURIComponent(attachment.id)}/download`,
      ),
  };
}

export type ConfluenceClient = ReturnType<typeof createConfluenceClient>;
