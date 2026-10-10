import { PageLayout, type PageCrumb } from '@bemmoly/core-web';
import { createContext, useContext, type ReactNode } from 'react';

/** The trail the Docs chunk works out from the address; a screen refines its end once loaded. */
const DocsCrumbs = createContext<readonly PageCrumb[]>([]);
export const DocsCrumbsProvider = DocsCrumbs.Provider;

export interface DocsLayoutProps {
  /**
   * contained: Docs home, a space's overview and its trash, in the 1040px reading column. full:
   * a page, which keeps its own 700px column, outline and margin beside it.
   */
  layout: 'full' | 'contained';
  /** After the trail: a page's status menu. */
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * Every Docs screen in the one frame: the shell's page header with the Docs trail, then one of
 * the two page layouts. The sidebar stays whatever the screen shows, errors included.
 */
export function DocsLayout({ layout, trailing, children }: DocsLayoutProps) {
  const crumbs = useContext(DocsCrumbs);
  return (
    <PageLayout layout={layout} header={{ crumbs, ...(trailing ? { trailing } : {}) }}>
      <div
        data-module="docs"
        className={
          layout === 'full' ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'flex min-w-0 flex-col'
        }
      >
        {children}
      </div>
    </PageLayout>
  );
}
