import type { ModuleChunkProps } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Suspense } from 'react';
import { resolveWorkRoute } from './routes.tsx';
import { ScreenSkeleton } from './skeletons/screen-skeleton.tsx';

/** The Work chunk: hands the subpath to routes.tsx and renders the screen it names. */
export default function WorkModule({ manifest, subpath }: ModuleChunkProps) {
  const route = resolveWorkRoute(subpath);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-module={manifest.id}>
      {route ? (
        <Suspense fallback={<ScreenSkeleton screen={route.name} />}>
          <route.Screen {...route.props} />
        </Suspense>
      ) : (
        <EmptyState title="No such Work screen" description={`Nothing lives at ${subpath}.`} />
      )}
    </div>
  );
}
