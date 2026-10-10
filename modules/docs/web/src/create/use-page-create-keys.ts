import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useCreatePage } from './use-create-page.ts';
import { useNewPageKey } from './use-new-page-key.ts';
import { useDocsShortcutHelp } from '../shared/shortcut-help.ts';

/**
 * On a page: N makes a page beside it (under the same parent) and Shift+N one inside it, in
 * place, as the tree's + does. Neither acts while the person writes, nor where they may not.
 * The "?" overlay lists the page's keys while it shows.
 */
export function usePageCreateKeys(page: PageDetail, spaceName: string, editable: boolean) {
  const { create } = useCreatePage();
  const parent = page.breadcrumbs.at(-1);
  useDocsShortcutHelp('page');
  useNewPageKey(
    editable
      ? () =>
          create({
            spaceId: page.spaceId,
            parentId: page.parentId,
            placeName: page.parentId ? parent?.title || 'Untitled' : spaceName,
          })
      : null,
  );
  useNewPageKey(
    editable
      ? () =>
          create({ spaceId: page.spaceId, parentId: page.id, placeName: page.title || 'Untitled' })
      : null,
    { shift: true },
  );
}
