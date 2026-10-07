import { useRouterState } from '@tanstack/react-router';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useModules } from '../../hooks/use-modules.ts';
import { EmptyState } from '../../ui.ts';
import { NotFoundPage } from '../not-found-page.tsx';

/** A settings panel a module registered; its screen ships with the module's web chunk. */
export function ModuleSettingsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: modules = [] } = useModules();
  const entry = modules
    .flatMap((module) => module.navigation)
    .find((nav) => nav.placement === 'settings' && nav.path === pathname);
  if (!entry) return <NotFoundPage />;
  return (
    <SettingsPage title={entry.label}>
      <EmptyState
        title="Nothing to configure here yet"
        body="This module's settings screen arrives with the module's own web chunk."
      />
    </SettingsPage>
  );
}
