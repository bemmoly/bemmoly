import { createHash } from 'node:crypto';
import type { RequestContext } from '@bemmoly/core';
import { slugify } from '@bemmoly/editor/convert';
import { NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import type { PdfExport, PdfExportBody } from '../../../../shared/pdf-export.ts';
import {
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { pageById } from '../pages/rows.ts';
import { pagesToExport } from '../transfer/export.ts';
import { notifyExportReady } from './notify.ts';
import { renderPdf } from './render.ts';
import { EXPORT_COLUMNS, toPdfExport, type ExportRow } from './rows.ts';

export const DOCS_EXPORT_PDF_JOB = 'docs.export-pdf';
export const DOCS_PURGE_EXPORTS_JOB = 'docs.purge-exports';

/** A render that takes longer than this also tells the person in their inbox. */
const SLOW_RENDER_MS = 10_000;

/**
 * PDF exports through the optional renderer (ADR 0033). A request writes a row and queues
 * docs.export-pdf under an idempotency key, so a retried request or a double click renders
 * once; the job renders as the person who asked, with their access, and keeps the PDF for a
 * day. Only that person reads the export.
 */
export function createPdfExportService(deps: DocsServiceDeps) {
  const sql = () => requireDatabase(deps);

  function renderer() {
    if (!deps.pdf) throw new NotFoundError('This install does not render PDFs');
    return deps.pdf;
  }

  async function own(ctx: RequestContext, exportId: string): Promise<ExportRow> {
    const [row] = await sql()<ExportRow[]>`
      select ${sql().unsafe(EXPORT_COLUMNS)} from page_exports
      where id = ${exportId} and requested_by = ${userIdOf(ctx)} and expires_at > now()`;
    if (!row) throw new NotFoundError('The export was not found');
    return row;
  }

  return {
    available: () => Boolean(deps.pdf),

    async request(
      ctx: RequestContext,
      pageId: string,
      body: PdfExportBody,
      idempotencyKey?: string,
    ): Promise<PdfExport> {
      renderer();
      const userId = userIdOf(ctx);
      if (!userId) throw new ValidationError('Only a person can export a PDF');
      if (!deps.jobs) throw new ProviderError('PDF exports need the job queue');
      const page = await pageById(sql(), pageId);
      const resource = spaceResource(page.space_id);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', resource);
      if (body.scope === 'subtree') {
        await ctx.authz.authorize(ctx.actor, 'docs.space.export', resource);
      }
      const key =
        idempotencyKey ??
        createHash('sha256')
          .update(
            JSON.stringify([
              page.id,
              body.scope,
              body.paper,
              page.version,
              page.content_updated_at,
            ]),
          )
          .digest('hex');
      const fileName = `${slugify(page.title || 'untitled')}.pdf`;
      // An export past its day under the same key gives way to a new one.
      await sql()`
        delete from page_exports
        where requested_by = ${userId} and idempotency_key = ${key} and expires_at <= now()`;
      const [created] = await sql()<ExportRow[]>`
        insert into page_exports (page_id, requested_by, idempotency_key, scope, paper, file_name)
        values (${page.id}, ${userId}, ${key}, ${body.scope}, ${body.paper}, ${fileName})
        on conflict (requested_by, idempotency_key) do nothing
        returning ${sql().unsafe(EXPORT_COLUMNS)}`;
      if (!created) {
        const [existing] = await sql()<ExportRow[]>`
          select ${sql().unsafe(EXPORT_COLUMNS)} from page_exports
          where requested_by = ${userId} and idempotency_key = ${key}`;
        if (!existing) throw new NotFoundError('The export was not found');
        return toPdfExport(existing);
      }
      await deps.jobs.send(
        DOCS_EXPORT_PDF_JOB,
        { exportId: created.id },
        {
          idempotencyKey: `${DOCS_EXPORT_PDF_JOB}:${created.id}`,
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        },
      );
      await recordAudit(deps, ctx, {
        action: 'page.exported',
        kind: 'page',
        id: page.id,
        after: { format: 'pdf', scope: body.scope, paper: body.paper },
      });
      return toPdfExport(created);
    },

    get: async (ctx: RequestContext, exportId: string) => toPdfExport(await own(ctx, exportId)),

    async file(ctx: RequestContext, exportId: string) {
      const row = await own(ctx, exportId);
      if (row.status !== 'ready') throw new NotFoundError('The PDF is not ready yet');
      const [file] = await sql()<{ pdf: Buffer }[]>`
        select pdf from page_exports where id = ${row.id}`;
      return { fileName: row.file_name, body: file!.pdf };
    },

    /** The docs.export-pdf job: renders as the person who asked; access was checked then. */
    async runQueued(exportId: string): Promise<void> {
      const [row] = await sql()<(ExportRow & { requested_by: string })[]>`
        select ${sql().unsafe(EXPORT_COLUMNS)}, requested_by from page_exports
        where id = ${exportId}`;
      if (!row || row.status === 'ready') return;
      if (!deps.contextFor) throw new ProviderError('PDF exports need the job context');
      const ctx = deps.contextFor({ kind: 'user', id: row.requested_by });
      const started = Date.now();
      try {
        const page = await pageById(sql(), row.page_id);
        await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(page.space_id));
        const pages = await pagesToExport(sql(), page, row.scope);
        const pdf = await renderPdf(deps, renderer(), ctx, { pages, paper: row.paper });
        await sql()`
          update page_exports
          set status = 'ready', pdf = ${pdf}, size = ${pdf.byteLength}, pages = ${pages.length},
            error = null, updated_at = now()
          where id = ${row.id}`;
        if (row.scope === 'subtree' || Date.now() - started > SLOW_RENDER_MS) {
          await notifyExportReady(deps, {
            ...row,
            pageId: page.id,
            title: page.title,
            pages: pages.length,
          });
        }
      } catch (error) {
        await sql()`
          update page_exports
          set status = 'failed', error = ${error instanceof Error ? error.message.slice(0, 500) : 'The render failed'},
            updated_at = now()
          where id = ${row.id}`;
        throw error;
      }
    },

    /** Removes exports past their day; the nightly purge calls it. */
    async purgeExpired(): Promise<number> {
      const rows = await sql()`delete from page_exports where expires_at < now() returning id`;
      return rows.length;
    },
  };
}

export type PdfExportService = ReturnType<typeof createPdfExportService>;
