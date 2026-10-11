import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  exportOptionsSchema,
  exportQuerySchema,
  pdfExportBodySchema,
  pdfExportSchema,
  type PdfExportBody,
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
      /** Whether this install renders PDFs; without it PDF is the browser's print view. */
      options: async () => http.request(`${DOCS_BASE}/exports/options`, exportOptionsSchema),
      /** Queues a PDF; asking twice for the same page as it is returns the same export. */
      createPdf: async (pageId: string, body: PdfExportBody) =>
        http.request(`${DOCS_BASE}/pages/${enc(pageId)}/exports`, pdfExportSchema, {
          method: 'POST',
          body: validated(pdfExportBodySchema, body),
        }),
      pdf: async (exportId: string) =>
        http.request(`${DOCS_BASE}/exports/${enc(exportId)}`, pdfExportSchema),
    },
  };
}
