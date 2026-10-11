import { PageLayout, type ModuleChunkProps } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Suspense } from 'react';
import { useWorkFrame } from './frame/work-frame.tsx';
import { resolveWorkRoute } from './routes.tsx';
import { ScreenSkeleton } from './skeletons/screen-skeleton.tsx';

/**
 * The Work chunk: hands the subpath to routes.tsx and renders the screen it names inside the
 * frame's page layout, with the header the route calls for, so the header stays put while the
 * screen loads.
 */
export default function WorkModule({ manifest, subpath }: ModuleChunkProps) {
  const route = resolveWorkRoute(subpath);
  const frame = useWorkFrame(
    manifest,
    route?.name ?? '',
    route?.props.projectKey,
    route?.props.rest ?? [],
  );
  return (
    <PageLayout
      layout={frame.layout}
      header={frame.header}
      {...(frame.title ? { title: frame.title } : {})}
    >
      <div className="flex min-h-0 flex-1 flex-col" data-module={manifest.id}>
        {route ? (
          <Suspense fallback={<ScreenSkeleton screen={route.name} />}>
            <route.Screen {...route.props} />
          </Suspense>
        ) : (
          <EmptyState title="No such Work screen" description={`Nothing lives at ${subpath}.`} />
        )}
      </div>
    </PageLayout>
  );
}
