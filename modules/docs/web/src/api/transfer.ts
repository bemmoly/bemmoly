import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  exportQuerySchema,
  importBodySchema,
  importResultSchema,
  type ExportQuery,
  type ImportBody,
} from '../../../shared/index.ts';
import { DOCS_BASE } from './pages.ts';

/** Exports download as files, so the client hands out their URL; imports post JSON. */
export function docsTransferEndpoints(http: Http) {
  return {
    transfer: {
      /** Where the browser downloads a page (or its subtree, zipped) from. */
      exportUrl: (pageId: string, query: Partial<ExportQuery> = {}) => {
        const { format, scope } = validated(exportQuerySchema, query);
        return `${DOCS_BASE}/pages/${enc(pageId)}/export?format=${format}&scope=${scope}`;
      },
      /** 201 with the pages for a small import; 202 with the queued job for a large one. */
      import: async (spaceRef: string, body: ImportBody) =>
        http.request(`${DOCS_BASE}/spaces/${enc(spaceRef)}/imports`, importResultSchema, {
          method: 'POST',
          body: validated(importBodySchema, body),
          idempotent: true,
        }),
    },
  };
}
