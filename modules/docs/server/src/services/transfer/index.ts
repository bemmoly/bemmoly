import { createHash } from 'node:crypto';
import type { RequestContext } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import {
  IMPORT_INLINE_MAX_BYTES,
  IMPORT_INLINE_MAX_FILES,
  type ExportQuery,
  type ImportBody,
  type ImportResult,
} from '../../../../shared/transfer.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { pageById } from '../pages/rows.ts';
import { spaceByRef } from '../spaces/rows.ts';
import { pagesToExport, renderExport, type ExportedFile } from './export.ts';
import { runImport, type ImportRun } from './run-import.ts';

export const DOCS_IMPORT_JOB = 'docs.import';

/**
 * Exports (a page or its subtree, as Markdown or self-contained HTML) and imports (Markdown
 * or Confluence storage format into a space). Small imports run inside the request; big ones
 * run as the docs.import job with an idempotency key, so a retried upload imports once.
 */
export function createTransferService(deps: DocsServiceDeps) {
  const sql = () => requireDatabase(deps);

  /** The job's work and the inline path's: write the pages, audit, wake the tree. */
  async function importNow(run: ImportRun, ctx?: RequestContext) {
    const pages = await runImport(
      sql(),
      run,
      async (tx, actor, after) => {
        await deps.audit?.record(
          {
            actor: ctx?.actor ?? actor,
            action: 'space.pages_imported',
            target: { kind: 'space', id: run.spaceId },
            after,
            ...(ctx?.requestId ? { meta: { requestId: ctx.requestId } } : {}),
          },
          tx,
        );
      },
      deps.entities,
    );
    await publishChange(
      deps,
      DOCS_REALTIME_KINDS.tree,
      run.spaceId,
      pages.map((page) => page.id),
    );
    return pages;
  }

  return {
    async exportPage(
      ctx: RequestContext,
      pageId: string,
      query: ExportQuery,
    ): Promise<ExportedFile> {
      const page = await pageById(sql(), pageId);
      const resource = spaceResource(page.space_id);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', resource);
      if (query.scope === 'subtree') {
        await ctx.authz.authorize(ctx.actor, 'docs.space.export', resource);
      }
      const pages = await pagesToExport(sql(), page, query.scope);
      const file = await renderExport(deps, ctx, pages, query);
      await recordAudit(deps, ctx, {
        action: 'page.exported',
        kind: 'page',
        id: pageId,
        after: { format: query.format, scope: query.scope, pages: pages.length },
      });
      return file;
    },

    async importPages(
      ctx: RequestContext,
      spaceRef: string,
      body: ImportBody,
      idempotencyKey?: string,
    ): Promise<ImportResult> {
      const space = await spaceByRef(sql(), spaceRef);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(space.id));
      const run: ImportRun = {
        spaceId: space.id,
        parentId: body.parentId ?? null,
        userId: userIdOf(ctx),
        format: body.format,
        files: body.files,
      };
      const bytes = body.files.reduce((sum, file) => sum + file.content.length, 0);
      if (body.files.length <= IMPORT_INLINE_MAX_FILES && bytes <= IMPORT_INLINE_MAX_BYTES) {
        return { status: 'completed', pages: await importNow(run, ctx) };
      }
      if (!deps.jobs) throw new ProviderError('Large imports need the job queue');
      const key =
        idempotencyKey ??
        createHash('sha256')
          .update(JSON.stringify([space.id, body]))
          .digest('hex');
      const jobId = await deps.jobs.send(
        DOCS_IMPORT_JOB,
        { ...run },
        {
          idempotencyKey: `${DOCS_IMPORT_JOB}:${space.id}:${key}`,
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        },
      );
      return { status: 'queued', jobId, idempotencyKey: key };
    },

    /** The docs.import job: the authorization was checked when the import was queued. */
    runQueuedImport: (run: ImportRun) => importNow(run),
  };
}

export type TransferService = ReturnType<typeof createTransferService>;
