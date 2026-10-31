import { useLoaded, useT, type ModuleChunkProps } from '@bemmoly/core-web';
import { EmptyState, TableSkeleton } from '@bemmoly/ui';
import { Suspense } from 'react';
import { peopleText } from './i18n/catalog.ts';
import { resolvePeopleRoute } from './routes.tsx';
import { PeopleLayout, PeopleManifestProvider } from './shared/layout.tsx';

function Loading() {
  const t = useT(peopleText);
  return (
    <PeopleLayout>
      <TableSkeleton
        label={t('people.loading')}
        rows={8}
        columns={[{ width: 'minmax(0,1fr)' }, { width: '160px' }, { width: '160px' }]}
      />
    </PeopleLayout>
  );
}

const loading = <Loading />;

/**
 * The People chunk: hands the subpath to routes.tsx and renders the screen it names inside
 * the frame. While a screen's file loads, a table skeleton holds the contained layout.
 */
export default function PeopleModule({ manifest, subpath }: ModuleChunkProps) {
  const t = useT(peopleText);
  const route = resolvePeopleRoute(subpath);
  const ready = useLoaded(route?.Screen ?? null);
  return (
    <PeopleManifestProvider value={manifest}>
      {route ? (
        <Suspense fallback={loading}>
          {ready ? <route.Screen.Component key={route.name} {...route.props} /> : loading}
        </Suspense>
      ) : (
        <PeopleLayout>
          <EmptyState
            headingLevel={1}
            title={t('people.notFound.title')}
            description={t('people.notFound.body', { path: subpath })}
          />
        </PeopleLayout>
      )}
    </PeopleManifestProvider>
  );
}
