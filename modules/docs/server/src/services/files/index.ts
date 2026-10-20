import type { FileTargetDefinition } from '@bemmoly/core';
import { UPLOAD_FILE_TYPES } from '@bemmoly/shared';
import { requireDatabase, type DocsServiceDeps } from '../common.ts';
import { DOCS_PAGE_KIND, type PageCollab } from '../collab/index.ts';

/**
 * Images, PDFs and HTML in a page are files of the page: whoever may edit the page body adds them, whoever
 * may read it sees them (the same verdict the live editor gets). A file stays while any page,
 * revision or template still names it, trashed pages included, so restoring brings it back.
 */
export function createPageFiles(deps: DocsServiceDeps, collab: PageCollab): FileTargetDefinition {
  const sql = () => requireDatabase(deps);
  return {
    kind: DOCS_PAGE_KIND,
    accepts: UPLOAD_FILE_TYPES,
    authorize: (ctx, pageId) => collab.definition.authorize(ctx, pageId),
    async referenced(fileIds) {
      if (fileIds.length === 0) return new Set();
      const rows = await sql()<{ id: string }[]>`
        select f.id from unnest(${sql().array([...fileIds])}::text[]) as f(id)
        where exists (select 1 from pages p where p.snapshot::text like '%' || f.id || '%')
          or exists (select 1 from page_revisions r where r.snapshot::text like '%' || f.id || '%')
          or exists (select 1 from templates t where t.snapshot::text like '%' || f.id || '%')`;
      return new Set(rows.map((row) => row.id));
    },
  };
}
