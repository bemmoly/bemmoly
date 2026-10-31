import type { Http } from '@bemmoly/api-client';
import { exportPreviewSchema, type ExportQuery } from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

const base = '/api/v1/pipelines/exports';

/** Platform › Export: what the bundle holds, and where the zip downloads from. */
export const exportKeys = {
  preview: (query: ExportQuery) => ['pipelines', 'platform', 'export', query] as const,
};

export function exportEndpoints(http: Http) {
  return {
    preview: (query: ExportQuery = {}) =>
      http.request(base, exportPreviewSchema, { query: toQuery(query) }),
    /** Downloaded by the browser itself, with the session cookie, named by the server. */
    archiveUrl: (query: ExportQuery = {}) => http.url(`${base}/archive`, toQuery(query)),
  };
}
