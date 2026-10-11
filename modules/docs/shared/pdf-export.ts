import { z } from 'zod';
import { timestampSchema } from '@bemmoly/shared';

/*
 * PDF exports, when the install runs the optional PDF renderer (ADR 0035).
 *   GET  /api/v1/docs/exports/options
 *        { pdf: true } when the renderer is configured; the web hides "Export as PDF" without it.
 *   POST /api/v1/docs/pages/:pageId/exports        { scope, paper }
 *        Queues the docs.export-pdf job under the request's Idempotency-Key (or one derived
 *        from the page, scope, paper and the page's last change). 202 with the export.
 *   GET  /api/v1/docs/exports/:exportId            the export's state, for the person who asked
 *   GET  /api/v1/docs/exports/:exportId/file       the PDF once it is ready
 */

export const PDF_PAPERS = ['a4', 'letter'] as const;
export const PDF_EXPORT_STATUSES = ['queued', 'ready', 'failed'] as const;

export const pdfExportBodySchema = z.object({
  scope: z.enum(['page', 'subtree']).default('page'),
  paper: z.enum(PDF_PAPERS).default('a4'),
});

export const exportOptionsSchema = z.object({
  /** The server renders PDFs; without it PDF goes through the browser's print view. */
  pdf: z.boolean(),
});

export const pdfExportSchema = z.object({
  id: z.uuid(),
  pageId: z.uuid(),
  scope: z.enum(['page', 'subtree']),
  paper: z.enum(PDF_PAPERS),
  status: z.enum(PDF_EXPORT_STATUSES),
  fileName: z.string(),
  pages: z.number().int().nonnegative(),
  size: z.number().int().nonnegative().nullable(),
  /** Where the browser downloads the PDF from, once it is ready. */
  downloadUrl: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});

export type PdfPaper = (typeof PDF_PAPERS)[number];
export type PdfExportBody = z.infer<typeof pdfExportBodySchema>;
export type PdfExport = z.infer<typeof pdfExportSchema>;
export type DocsExportOptions = z.infer<typeof exportOptionsSchema>;
