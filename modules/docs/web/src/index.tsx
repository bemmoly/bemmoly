import type { ModuleChunkProps } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Suspense } from 'react';
import { resolveDocsRoute } from './routes.tsx';
import { ScreenSkeleton } from './skeletons/docs-skeletons.tsx';

/** The Docs chunk: hands the subpath to routes.tsx and renders the screen it names. */
export default function DocsModule({ manifest, subpath }: ModuleChunkProps) {
  const route = resolveDocsRoute(subpath);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-module={manifest.id}>
      {route ? (
        <Suspense fallback={<ScreenSkeleton screen={route.name} />}>
          <route.Screen {...route.props} />
        </Suspense>
      ) : (
        <EmptyState
          headingLevel={1}
          className="flex-1 justify-center"
          title="No such Docs screen"
          description={`Nothing lives at ${subpath}.`}
        />
      )}
    </div>
  );
}
