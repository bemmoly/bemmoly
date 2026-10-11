import {
  canOpen,
  ErrorBoundary,
  ModuleTile,
  moduleName,
  moduleSettingsOf,
  PageLayout,
  useLoaded,
  type PageCrumb,
} from '@bemmoly/core-web';
import type { ModuleManifest } from '@bemmoly/shared';
import { EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRouterState } from '@tanstack/react-router';
import { createElement, type ReactNode } from 'react';
import { Loading } from '../../components/form.tsx';
import { PageFailure } from '../../components/page-failure.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useModules } from '../../hooks/use-modules.ts';
import { useMe } from '../../hooks/use-session.ts';
import { MODULE_SETTINGS } from '../../lib/module-shell.ts';
import { viewerOf } from '../../lib/session.ts';
import { NotFoundPage } from '../not-found-page.tsx';

/** "Settings / Modules / Work": the trail a module's settings pages start from. */
function crumbsOf(manifest: ModuleManifest, path: string): PageCrumb[] {
  return [
    { label: 'Settings', path: '/settings', icon: <Icon name="settings" size={15} /> },
    { label: 'Modules', path: '/settings/modules' },
    { label: moduleName(manifest), path, icon: <ModuleTile manifest={manifest} size={15} /> },
  ];
}

/** The frame around a module's settings while its entry loads, or when it cannot draw them. */
function Framed({ crumbs, children }: { crumbs: PageCrumb[]; children: ReactNode }) {
  return (
    <PageLayout layout="contained" header={{ crumbs }}>
      {children}
    </PageLayout>
  );
}

/**
 * A module's own settings, declared in its manifest and drawn by its `settings.tsx` entry,
 * which brings its own page layout. Opening them needs what the manifest asks (workspace
 * admins by default); the server checks every change again.
 */
function DeclaredSettings({ manifest, pathname }: { manifest: ModuleManifest; pathname: string }) {
  const me = useMe();
  const entry = MODULE_SETTINGS.resolve(manifest.id);
  const ready = useLoaded(entry);
  const settings = manifest.settings;
  if (!settings) return null;
  const crumbs = crumbsOf(manifest, settings.path);
  const name = moduleName(manifest);
  if (!canOpen(settings.requires, viewerOf(me))) {
    return (
      <Framed crumbs={crumbs}>
        <EmptyState
          icon={<Icon name="lock" />}
          title={`Only workspace admins can change ${name} settings`}
          description="Ask a workspace admin if something here should change for everyone."
        />
      </Framed>
    );
  }
  if (!entry) {
    return (
      <Framed crumbs={crumbs}>
        <EmptyState
          title="Nothing to configure here yet"
          description={`${name} has no settings of its own in this version.`}
        />
      </Framed>
    );
  }
  if (!ready) {
    return (
      <Framed crumbs={crumbs}>
        <Loading lines={4} label={`Loading ${name} settings`} />
      </Framed>
    );
  }
  const subpath = pathname.slice(settings.path.length) || '/';
  return (
    <ErrorBoundary
      resetKey={manifest.id}
      fallback={(error, retry) => <PageFailure framed error={error} onRetry={retry} />}
    >
      {createElement(entry.Component, { manifest, subpath, crumbs })}
    </ErrorBoundary>
  );
}

/** A settings panel a module registered: its own pages, or a placeholder from older servers. */
export function ModuleSettingsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: modules = [] } = useModules();
  const declared = moduleSettingsOf(modules, pathname);
  if (declared) return <DeclaredSettings manifest={declared} pathname={pathname} />;
  const entry = modules
    .flatMap((module) => module.navigation)
    .find((nav) => nav.placement === 'settings' && nav.path === pathname);
  if (!entry) return <NotFoundPage />;
  return (
    <SettingsPage title={entry.label}>
      <EmptyState
        title="Nothing to configure here yet"
        description="This module's settings screen arrives with the module's own web chunk."
      />
    </SettingsPage>
  );
}
