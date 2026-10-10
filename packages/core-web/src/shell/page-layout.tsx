import { useEffect, useState, type ReactNode } from 'react';
import { isActivePath, useFrame } from './frame-context.ts';
import {
  ActionsSlotProvider,
  PageHeader,
  TrailContext,
  type PageCrumb,
  type PageHeaderProps,
} from './page-header.tsx';

/** "Board · Platform Core · Bemmoly": the page, its context, then the product, always last. */
export function useDocumentTitle(parts: readonly (string | null | undefined)[]): void {
  const title = [...parts.filter(Boolean), 'Bemmoly'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export interface PageLayoutProps {
  header: PageHeaderProps;
  /**
   * full: Board, Backlog, Inbox and editors, full bleed with 24px gutters; the screen fills the
   * height and scrolls its own panes. contained: Home, Projects, Settings and the Issue page, a
   * 1040px reading column that the layout scrolls.
   */
  layout: 'full' | 'contained';
  /** The tab title's parts, most specific first; derived from the header when left out. */
  title?: readonly string[];
  children: ReactNode;
}

function titleFrom(header: PageHeaderProps, pathname: string, context?: string): string[] {
  const crumbs = header.crumbs;
  const last = crumbs.at(-1)?.label;
  const tab =
    header.tabs?.find((entry) => entry.id === header.activeTab) ??
    header.tabs?.find((entry) => isActivePath(pathname, entry.path));
  if (tab) return [tab.label, last ?? ''];
  return [last ?? '', crumbs.at(-2)?.label ?? context ?? ''];
}

/**
 * Every page in the frame: the sticky 52px header, then one scroll region the layout owns, so
 * the header never scrolls away and no page grows a second scrollbar around the first.
 */
export function PageLayout({ header, layout, title, children }: PageLayoutProps) {
  const { pathname, workspaceName } = useFrame();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [tail, setTail] = useState<readonly PageCrumb[] | null>(null);
  const crumbs = tail ? [...header.crumbs.slice(0, -1), ...tail] : header.crumbs;
  // A page with a single part ("Inbox") takes the workspace as its context.
  const parts = title ?? titleFrom(header, pathname, workspaceName);
  useDocumentTitle(parts.filter(Boolean).length === 1 ? [...parts, workspaceName] : parts);
  return (
    <ActionsSlotProvider value={slot}>
      <TrailContext.Provider value={setTail}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
          <PageHeader {...header} crumbs={crumbs} onActionsSlot={setSlot} />
          {layout === 'full' ? (
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
              {children}
            </div>
          ) : (
            <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto" data-scroll-region>
              <div className="mx-auto flex w-full max-w-260 min-w-0 flex-col px-4 pt-6 pb-16 md:px-8 md:pt-8">
                {children}
              </div>
            </div>
          )}
        </div>
      </TrailContext.Provider>
    </ActionsSlotProvider>
  );
}
