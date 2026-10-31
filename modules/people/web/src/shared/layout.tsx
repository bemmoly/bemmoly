import { ModuleTile, PageLayout, useT, type PageCrumb, type PageTab } from '@bemmoly/core-web';
import type { ModuleManifest } from '@bemmoly/shared';
import { createContext, useContext, type ReactNode } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { keepLinksInApp } from './links.ts';
import { peoplePaths } from './paths.ts';

const Manifest = createContext<ModuleManifest | null>(null);
export const PeopleManifestProvider = Manifest.Provider;

export interface PeopleLayoutProps {
  /** Crumbs after "People". */
  trail?: readonly PageCrumb[];
  tabs?: readonly PageTab[];
  activeTab?: string;
  layout?: 'contained' | 'full';
  children: ReactNode;
}

/** Every People screen in the one frame, its trail starting at the People tile. */
export function PeopleLayout({
  trail = [],
  tabs,
  activeTab,
  layout = 'contained',
  children,
}: PeopleLayoutProps) {
  const manifest = useContext(Manifest);
  const t = useT(peopleText);
  const root: PageCrumb = {
    label: manifest?.name ?? t('people.name'),
    path: peoplePaths.directory(),
    ...(manifest ? { icon: <ModuleTile manifest={manifest} size={16} /> } : {}),
  };
  return (
    <PageLayout
      layout={layout}
      header={{
        crumbs: [root, ...trail],
        ...(tabs ? { tabs } : {}),
        ...(activeTab ? { activeTab } : {}),
      }}
    >
      {/* Links inside stay in the app: a click on one moves through the shell router. */}
      <div data-module="people" className="flex min-w-0 flex-col gap-4" onClick={keepLinksInApp}>
        {children}
      </div>
    </PageLayout>
  );
}
