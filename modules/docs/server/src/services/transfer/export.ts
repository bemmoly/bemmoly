import { posix } from 'node:path';
import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { collectReferences, slugify, toHtmlDocument, toMarkdown } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';
import type { ExportQuery } from '../../../../shared/transfer.ts';
import type { DocsServiceDeps } from '../common.ts';
import { pagePath } from '../palette/index.ts';
import { createZip } from '../../utils/zip.ts';

/*
 * Turning pages into files. Each page is one file named after its title; a page with
 * children also gets a folder of the same name holding theirs. Links between exported pages
 * point at each other's files, relatively, so the export reads offline; links to anything
 * else point into the app. Issue keys link to the issue when a module that serves issues
 * resolves them for the person.
 */

export interface ExportedFile {
  fileName: string;
  contentType: string;
  body: Buffer | string;
}

interface ExportPage {
  id: string;
  parent_id: string | null;
  title: string;
  snapshot: RichText | null;
}

type Readable = Parameters<typeof toMarkdown>[0];

/** File paths for a tree of pages, siblings with the same title told apart by a number. */
function filePaths(pages: readonly ExportPage[], rootId: string, extension: string) {
  const paths = new Map<string, string>();
  const folders = new Map<string, string>();
  const taken = new Map<string, Set<string>>();
  for (const page of pages) {
    const folder = page.id === rootId ? '' : (folders.get(page.parent_id ?? '') ?? '');
    const used = taken.get(folder) ?? new Set<string>();
    const base = slugify(page.title || 'untitled');
    let name = base;
    for (let n = 2; used.has(name); n += 1) name = `${base}-${n}`;
    used.add(name);
    taken.set(folder, used);
    paths.set(page.id, `${folder}${name}.${extension}`);
    folders.set(page.id, `${folder}${name}/`);
  }
  return paths;
}

async function issueLinks(
  deps: Pick<DocsServiceDeps, 'entities'>,
  ctx: RequestContext,
  pages: readonly ExportPage[],
): Promise<Map<string, string>> {
  const keys = new Set(
    pages.flatMap((page) =>
      collectReferences(page.snapshot as Readable).flatMap((ref) =>
        ref.kind === 'issue' ? [ref.key] : [],
      ),
    ),
  );
  const links = new Map<string, string>();
  for (const key of keys) {
    const issue = await deps.entities?.resolve('issue', { key }, ctx);
    if (issue) links.set(key, issue.path);
  }
  return links;
}

/** The page and, for a subtree, every live page under it, parents before children. */
export async function pagesToExport(
  sql: SqlExecutor,
  root: { id: string; path: string },
  scope: ExportQuery['scope'],
): Promise<ExportPage[]> {
  if (scope === 'page') {
    return sql<ExportPage[]>`
      select id, parent_id, title, snapshot from pages where id = ${root.id}`;
  }
  return sql<ExportPage[]>`
    select id, parent_id, title, snapshot from pages
    where path like ${`${root.path}%`} and deleted_at is null
    order by length(path), position, id`;
}

export async function renderExport(
  deps: Pick<DocsServiceDeps, 'entities'>,
  ctx: RequestContext,
  pages: readonly ExportPage[],
  query: ExportQuery,
): Promise<ExportedFile> {
  const root = pages[0]!;
  const extension = query.format === 'markdown' ? 'md' : 'html';
  const paths = filePaths(pages, root.id, extension);
  const issues = await issueLinks(deps, ctx, pages);
  const render = (page: ExportPage) => {
    const here = posix.dirname(paths.get(page.id)!);
    const options = {
      pageHref: (pageId: string) => {
        const target = paths.get(pageId);
        if (!target) return pagePath(pageId);
        const relative = posix.relative(here, target);
        return relative.startsWith('../') ? relative : `./${relative}`;
      },
      issueHref: (key: string) => issues.get(key) ?? null,
    };
    const title = page.title || 'Untitled';
    return query.format === 'markdown'
      ? `# ${title}\n\n${toMarkdown(page.snapshot as Readable, options)}`
      : toHtmlDocument(page.snapshot as Readable, title, options);
  };
  if (query.scope === 'page') {
    return {
      fileName: paths.get(root.id)!,
      contentType:
        query.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8',
      body: render(root),
    };
  }
  return {
    fileName: `${slugify(root.title || 'untitled')}.zip`,
    contentType: 'application/zip',
    body: createZip(pages.map((page) => ({ name: paths.get(page.id)!, data: render(page) }))),
  };
}
