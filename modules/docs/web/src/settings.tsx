import { PageLayout, type ModuleSettingsProps } from '@bemmoly/core-web';
import { TableSkeleton } from '@bemmoly/ui';
import { lazy, Suspense } from 'react';

const DocsSettingsScreen = lazy(async () => ({
  default: (await import('./settings/docs-settings-screen.tsx')).DocsSettingsScreen,
}));

/**
 * Settings › Docs (/settings/docs): the org templates every space's picker offers. The shell
 * hands over the trail; the screen loads on its own, never with Docs' screens, and keeps the
 * open template in the address, so it stays in the reading column for the list, the read view
 * and the editor alike.
 */
export default function DocsSettings({ crumbs }: ModuleSettingsProps) {
  return (
    <PageLayout layout="contained" header={{ crumbs }}>
      <Suspense
        fallback={
          <TableSkeleton
            label="Loading the org templates"
            rows={6}
            columns={[{ width: 'minmax(0,1fr)' }, { width: '120px' }, { width: '88px' }]}
          />
        }
      >
        <DocsSettingsScreen />
      </Suspense>
    </PageLayout>
  );
}
