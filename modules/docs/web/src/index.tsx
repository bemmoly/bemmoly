import {
  ModuleTile,
  navigateInApp,
  useLoaded,
  withCreate,
  type ModuleChunkProps,
  type PageCrumb,
} from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Suspense, useEffect } from 'react';
import { useSpace } from './hooks/queries.ts';
import { resolveDocsRoute } from './routes.tsx';
import { DocsCrumbsProvider, DocsLayout } from './shared/docs-layout.tsx';
import { docsPaths } from './shared/navigation.ts';
import { ScreenSkeleton } from './skeletons/docs-skeletons.tsx';
import { SpaceTile } from './space/space-tile.tsx';

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

/**
 * The trail the address names before any data: Docs, then the space (and its trash). A page
 * names its own trail once it has loaded, space › parents › page (page-frame.tsx).
 */
function useDocsCrumbs(
  manifest: ModuleChunkProps['manifest'],
  screen: string | undefined,
  segment: string | undefined,
  rest: readonly string[],
): PageCrumb[] {
  const space = useSpace(screen === 's' ? segment : undefined);
  const docs: PageCrumb = {
    label: manifest.name ?? 'Docs',
    path: docsPaths.home(),
    icon: <ModuleTile manifest={manifest} size={16} />,
  };
  if (screen === 'p' && segment) return [{ label: 'Page', path: docsPaths.page(segment) }];
  if (screen !== 's' || !segment) return [docs];
  const spaceCrumb: PageCrumb = {
    label: space.data?.name ?? segment,
    path: docsPaths.space(segment),
    ...(space.data ? { icon: <SpaceTile space={space.data} size={16} /> } : {}),
  };
  if (rest[0] === 'trash') {
    const trash = { label: 'Trash', path: docsPaths.trash(segment), icon: <Icon name="trash" /> };
    return [spaceCrumb, trash];
  }
  return [docs, spaceCrumb];
}

/**
 * The Docs chunk: hands the subpath to routes.tsx and renders the screen it names inside the
 * frame. Each screen picks its layout (the page full, the lists contained); while a screen's
 * chunk loads, its skeleton holds the same layout. The space tree lives in the sidebar.
 */
export default function DocsModule({ manifest, subpath }: ModuleChunkProps) {
  const route = resolveDocsRoute(subpath);
  const ready = useLoaded(route?.Screen ?? null);
  const props = route?.props;
  useCreateRedirect(props?.screen, props?.segment);
  const crumbs = useDocsCrumbs(manifest, props?.screen, props?.segment, props?.rest ?? []);
  const loading = route ? (
    <DocsLayout layout={route.name === 'p' ? 'full' : 'contained'}>
      <ScreenSkeleton screen={route.name} />
    </DocsLayout>
  ) : null;
  return (
    <DocsCrumbsProvider value={crumbs}>
      {route ? (
        <Suspense fallback={loading}>
          {ready ? <route.Screen.Component {...route.props} /> : loading}
        </Suspense>
      ) : (
        <DocsLayout layout="contained">
          <EmptyState
            headingLevel={1}
            className="flex-1 justify-center"
            title="No such Docs screen"
            description={`Nothing lives at ${subpath}.`}
          />
        </DocsLayout>
      )}
    </DocsCrumbsProvider>
  );
}
