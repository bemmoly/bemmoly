import type { PdfExport, PdfPaper } from '../../../../shared/pdf-export.ts';
import { iso } from '../common.ts';

/** Every column but the PDF itself, which only the download reads. */
export const EXPORT_COLUMNS = `id, page_id, scope, paper, status, file_name, pages, size, error,
  created_at, expires_at`;

export interface ExportRow {
  id: string;
  page_id: string;
  scope: 'page' | 'subtree';
  paper: PdfPaper;
  status: PdfExport['status'];
  file_name: string;
  pages: number;
  size: number | null;
  error: string | null;
  created_at: Date | string;
  expires_at: Date | string;
}

export const exportFilePath = (exportId: string) => `/api/v1/docs/exports/${exportId}/file`;

export const toPdfExport = (row: ExportRow): PdfExport => ({
  id: row.id,
  pageId: row.page_id,
  scope: row.scope,
  paper: row.paper,
  status: row.status,
  fileName: row.file_name,
  pages: row.pages,
  size: row.size,
  downloadUrl: row.status === 'ready' ? exportFilePath(row.id) : null,
  error: row.status === 'failed' ? 'The PDF could not be made. Try again in a moment.' : null,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
});
