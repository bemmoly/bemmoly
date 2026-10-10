import {
  ModuleTile,
  navigateInApp,
  PageLayout,
  useLoaded,
  withCreate,
  type ModuleChunkProps,
  type PageCrumb,
} from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Suspense, useEffect } from 'react';
import { useSpace } from './hooks/queries.ts';
import { resolveDocsRoute } from './routes.tsx';
import { docsPaths } from './shared/navigation.ts';
import { ScreenSkeleton } from './skeletons/docs-skeletons.tsx';

/**
 * The old Create menu addresses (/docs/create, /docs/spaces/new) open the dialog over the Docs
 * home instead, by the frame's ?create= address, replacing this one.
 */
function useCreateRedirect(screen: string | undefined, segment: string | undefined) {
  const entry =
    screen === 'create'
      ? 'docs.create-page'
      : screen === 'spaces' && segment === 'new'
        ? 'docs.create-space'
        : null;
  useEffect(() => {
    if (entry) navigateInApp(withCreate(docsPaths.home(), entry), { replace: true });
  }, [entry]);
}

/** Docs, then the space on show; a page's own trail sits in its bar. */
function useDocsCrumbs(
  manifest: ModuleChunkProps['manifest'],
  screen: string | undefined,
  segment: string | undefined,
) {
  const space = useSpace(screen === 's' ? segment : undefined);
  const docs: PageCrumb = {
    label: manifest.name ?? 'Docs',
    path: docsPaths.home(),
    icon: <ModuleTile manifest={manifest} size={16} />,
  };
  // The page screen names itself in the trail once it has loaded (page-frame.tsx).
  if (screen === 'p' && segment) return [docs, { label: 'Page', path: docsPaths.page(segment) }];
  if (screen !== 's' || !segment) return [docs];
  return [docs, { label: space.data?.name ?? segment, path: docsPaths.space(segment) }];
}

/**
 * The Docs chunk: hands the subpath to routes.tsx and renders the screen it names inside the
 * frame, drawing the screen's skeleton while its chunk loads. The space tree stays inside the
 * space's pages.
 */
export default function DocsModule({ manifest, subpath }: ModuleChunkProps) {
  const route = resolveDocsRoute(subpath);
  const ready = useLoaded(route?.Screen ?? null);
  useCreateRedirect(route?.props.screen, route?.props.segment);
  const crumbs = useDocsCrumbs(manifest, route?.props.screen, route?.props.segment);
  return (
    <PageLayout layout="full" header={{ crumbs }}>
      <div className="flex min-h-0 flex-1 flex-col" data-module={manifest.id}>
        {route ? (
          <Suspense fallback={<ScreenSkeleton screen={route.name} />}>
            {ready ? (
              <route.Screen.Component {...route.props} />
            ) : (
              <ScreenSkeleton screen={route.name} />
            )}
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
    </PageLayout>
  );
}
