import type { PdfRenderer, RequestContext } from '@bemmoly/core';
import { toPrintDocument, type PrintPage } from '@bemmoly/editor/print';
import type { PdfPaper } from '../../../../shared/pdf-export.ts';
import type { DocsServiceDeps } from '../common.ts';
import { pagePath } from '../palette/index.ts';
import { collectImages, dataUri } from '../transfer/export-images.ts';
import { resolveIssues, type ExportPage } from '../transfer/export.ts';

/*
 * One PDF from a page or a subtree. Images the person may read are embedded as data: URIs and
 * every other image prints its alt text, so the renderer, which may reach no network, never
 * has a reason to fetch. Links to pages outside the export point into the app, absolutely.
 */

type Readable = PrintPage['doc'];

const statusOf = (data: Record<string, unknown> | undefined): string | undefined => {
  const status = data?.['status'];
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object' && 'name' in status) {
    const name = (status as { name: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
};

/** Depth of each page under the first, from the parent links the query returned. */
function depths(pages: readonly ExportPage[]): Map<string, number> {
  const depth = new Map<string, number>();
  for (const page of pages) {
    depth.set(
      page.id,
      page.parent_id && depth.has(page.parent_id) ? depth.get(page.parent_id)! + 1 : 0,
    );
  }
  return depth;
}

export async function renderPdf(
  deps: Pick<DocsServiceDeps, 'entities' | 'files'>,
  renderer: PdfRenderer,
  ctx: RequestContext,
  input: { pages: readonly ExportPage[]; paper: PdfPaper },
): Promise<Buffer> {
  const { pages } = input;
  const issues = await resolveIssues(deps, ctx, pages);
  const images = await collectImages(
    deps.files,
    ctx,
    pages.map((page) => page.snapshot),
  );
  const depth = depths(pages);
  const absolute = (path: string) => new URL(path, renderer.publicUrl).toString();
  const title = pages[0]?.title || 'Untitled';
  const document = toPrintDocument(
    title,
    pages.map((page) => ({
      id: page.id,
      title: page.title,
      doc: page.snapshot as Readable,
      depth: depth.get(page.id) ?? 0,
    })),
    {
      paper: input.paper,
      pageHref: (pageId) => absolute(pagePath(pageId)),
      issueHref: (key) => {
        const issue = issues.get(key);
        return issue ? absolute(issue.path) : null;
      },
      issueSummary: (key) => {
        const issue = issues.get(key);
        if (!issue) return null;
        const status = statusOf(issue.data);
        return { title: issue.title, ...(status ? { status } : {}) };
      },
      // An image the person may not read, or one on another site, prints its alt text.
      imageSrc: (src) => {
        const image = images.get(src);
        return image ? dataUri(image) : false;
      },
    },
  );
  return renderer.render({
    html: document.html,
    headerHtml: document.headerHtml,
    footerHtml: document.footerHtml,
    paper: input.paper,
  });
}
