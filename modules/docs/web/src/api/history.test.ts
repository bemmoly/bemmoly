import type { Http } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { docsHistoryEndpoints } from './history.ts';
import { docsTransferEndpoints } from './transfer.ts';

const PAGE = '0193a1b2-0000-7000-8000-000000000001';
const OTHER = '0193a1b2-0000-7000-8000-000000000002';

function recordingHttp() {
  const calls: { path: string; method: string; query?: unknown; body?: unknown }[] = [];
  const http = {
    request: async (path: string, _schema: unknown, options: Record<string, unknown> = {}) => {
      calls.push({
        path,
        method: (options.method as string | undefined) ?? 'GET',
        ...(options.query ? { query: options.query } : {}),
        ...(options.body ? { body: options.body } : {}),
      });
      return {};
    },
    send: async (path: string, options: Record<string, unknown> = {}) => {
      calls.push({ path, method: options.method as string });
    },
  } as unknown as Http;
  return { http, calls };
}

describe('the docs history, comments, links and transfer client', () => {
  it('calls each route with its method, query and body', async () => {
    const { http, calls } = recordingHttp();
    const api = docsHistoryEndpoints(http);
    await api.revisions.list(PAGE, { limit: 20 });
    await api.revisions.create(PAGE, { label: 'Before launch' });
    await api.revisions.restore(PAGE, OTHER);
    await api.revisions.compare(PAGE, { from: OTHER });
    await api.comments.list(PAGE, { resolved: false });
    await api.comments.resolve(OTHER);
    await api.comments.applySuggestion(OTHER);
    await api.comments.remove(OTHER);
    await api.links.linkedDocs({ kind: 'issue', key: 'PLT-1' });
    expect(calls).toEqual([
      { path: `/api/v1/docs/pages/${PAGE}/revisions`, method: 'GET', query: { limit: 20 } },
      {
        path: `/api/v1/docs/pages/${PAGE}/revisions`,
        method: 'POST',
        body: { label: 'Before launch' },
      },
      { path: `/api/v1/docs/pages/${PAGE}/revisions/${OTHER}/restore`, method: 'POST' },
      {
        path: `/api/v1/docs/pages/${PAGE}/revisions/compare`,
        method: 'GET',
        query: { from: OTHER, to: 'current' },
      },
      { path: `/api/v1/docs/pages/${PAGE}/comments`, method: 'GET', query: { resolved: false } },
      { path: `/api/v1/docs/comments/${OTHER}/resolve`, method: 'POST' },
      { path: `/api/v1/docs/comments/${OTHER}/apply-suggestion`, method: 'POST' },
      { path: `/api/v1/docs/comments/${OTHER}`, method: 'DELETE' },
      { path: '/api/v1/docs/references', method: 'GET', query: { kind: 'issue', key: 'PLT-1' } },
    ]);
  });

  it('builds export URLs and refuses an unknown format before sending', () => {
    const { http } = recordingHttp();
    const { transfer } = docsTransferEndpoints(http);
    expect(transfer.exportUrl(PAGE)).toBe(
      `/api/v1/docs/pages/${PAGE}/export?format=markdown&scope=page`,
    );
    expect(transfer.exportUrl(PAGE, { format: 'html', scope: 'subtree' })).toBe(
      `/api/v1/docs/pages/${PAGE}/export?format=html&scope=subtree`,
    );
    expect(() => transfer.exportUrl(PAGE, { format: 'pdf' as never })).toThrow();
  });
});
