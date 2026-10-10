import type { ExportQuery, PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';

/*
 * The page's exports for the header's More menu. A file downloads from the export route
 * with the session cookie, named by the server; the page and everything under it comes as
 * a .zip and needs the space's export right, so it is offered only to those who hold it.
 */

export interface ExportAction {
  id: string;
  label: string;
  hint: string;
  query: ExportQuery;
  run: () => void;
}

/** Starts a download of `url` without leaving the page. */
export function download(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

const CHOICES: readonly Omit<ExportAction, 'run'>[] = [
  {
    id: 'markdown',
    label: 'Export as Markdown',
    hint: '.md',
    query: { format: 'markdown', scope: 'page' },
  },
  { id: 'html', label: 'Export as HTML', hint: '.html', query: { format: 'html', scope: 'page' } },
  {
    id: 'subtree-markdown',
    label: 'Export with subpages as Markdown',
    hint: '.zip',
    query: { format: 'markdown', scope: 'subtree' },
  },
  {
    id: 'subtree-html',
    label: 'Export with subpages as HTML',
    hint: '.zip',
    query: { format: 'html', scope: 'subtree' },
  },
];

export function useExportActions(
  page: Pick<PageDetail, 'id' | 'hasChildren' | 'deletedAt'>,
): ExportAction[] {
  const { can } = useSession();
  const toast = useToast();
  const subtree = page.hasChildren && can('docs.space.export');
  return useMemo(
    () =>
      page.deletedAt
        ? []
        : CHOICES.filter((choice) => choice.query.scope === 'page' || subtree).map((choice) => ({
            ...choice,
            run: () => {
              download(api.docs.transfer.exportUrl(page.id, choice.query));
              toast.show({ tone: 'info', title: 'Preparing your download', duration: 2500 });
            },
          })),
    [page.id, page.deletedAt, subtree, toast],
  );
}
