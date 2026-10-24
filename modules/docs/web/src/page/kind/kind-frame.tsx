import { HeaderActions, useRecordRecent } from '@bemmoly/core-web';
import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useMemo, type ReactNode } from 'react';
import { DocsLayout } from '../../shared/docs-layout.tsx';
import { docsPaths } from '../../shared/navigation.ts';
import { useSpaceActions } from '../../space/space-layout.tsx';
import { PageBanner } from '../body/page-banner.tsx';
import { StarButton, usePageTrail } from '../header/page-header-bar.tsx';
import { StatusMenu } from '../header/status-menu.tsx';
import { PageScreenContext } from '../screen-context.ts';
import { SharePopover } from '../share/share-popover.tsx';
import { KindMoreMenu } from './kind-more-menu.tsx';
import { kindReadOnly, kindScreen } from './kind-screen.ts';

function KindHeaderActions() {
  usePageTrail();
  return (
    <HeaderActions>
      <StarButton />
      <span className="hidden md:inline-flex">
        <SharePopover />
      </span>
      <KindMoreMenu />
    </HeaderActions>
  );
}

/**
 * The frame around a page with no written body (ADR 0049): the one header with the trail,
 * status (file pages only; a folder is never reviewed), star, Share and ···, then the
 * banners and the body the kind draws.
 */
export function KindFrame({ page, children }: { page: PageDetail; children: ReactNode }) {
  const readOnly = kindReadOnly(page);
  const screen = useMemo(() => kindScreen(page, readOnly), [page, readOnly]);
  const { space } = useSpaceActions();
  useRecordRecent({
    id: `docs.page:${page.id}`,
    title: page.title || 'Untitled',
    context: space.name,
    path: docsPaths.page(page.id),
    look: { kind: 'icon', icon: page.kind === 'folder' ? 'folder' : 'file-page', moduleId: 'docs' },
    group: 'Pages',
  });
  return (
    <PageScreenContext.Provider value={screen}>
      <DocsLayout layout="full" {...(page.kind === 'file' ? { trailing: <StatusMenu /> } : {})}>
        <KindHeaderActions />
        <div className="flex min-h-0 flex-1 flex-col bg-canvas" data-page-id={page.id}>
          <PageBanner />
          {children}
        </div>
      </DocsLayout>
    </PageScreenContext.Provider>
  );
}
