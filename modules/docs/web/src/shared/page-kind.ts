import type { PageKind } from '@bemmoly/module-docs/shared';

/** What a folder or a file page is drawn with when it has no icon of its own (ADR 0049). */
const KIND_ICON: Record<PageKind, string | null> = {
  page: null,
  file: 'file-page',
  folder: 'folder',
};

/** The icon to draw for a page: its own, else its kind's, else nothing (the doc icon). */
export const iconOfPage = (page: { icon: string | null; kind?: PageKind | undefined }) =>
  page.icon ?? KIND_ICON[page.kind ?? 'page'];
