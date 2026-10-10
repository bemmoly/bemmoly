import { EntityRenderersProvider, ModuleOutlet, moduleName, PageLayout } from '@bemmoly/core-web';
import type { ModuleManifest } from '@bemmoly/shared';
import { useParams } from '@tanstack/react-router';
import { PageFailure } from '../components/page-failure.tsx';
import { useModule, useModules } from '../hooks/use-modules.ts';
import { ENTITY_RENDERERS } from '../lib/entity-renderers.ts';
import { MODULE_CHUNKS } from '../lib/module-chunks.ts';
import { Loading } from '../components/form.tsx';
import { NotFoundPage } from './not-found-page.tsx';

/** While a module's code loads: its header already in place, so nothing jumps when it lands. */
function ModuleLoading({ manifest }: { manifest?: ModuleManifest | undefined }) {
  const crumbs = manifest
    ? [{ label: moduleName(manifest), path: manifest.sidebar?.path ?? `/${manifest.id}` }]
    : [];
  return (
    <PageLayout layout="full" header={{ crumbs }}>
      <div className="px-6 pt-4">
        <Loading lines={4} label={manifest ? `Loading ${moduleName(manifest)}` : 'Loading'} />
      </div>
    </PageLayout>
  );
}

/**
 * A module's area: its lazy chunk under /<module id>, inside its own error boundary, with
 * the record renderers of every module this person can open (Docs draws Work's issues).
 */
export function ModulePage() {
  const params = useParams({ strict: false }) as { moduleId?: string; _splat?: string };
  const moduleId = params.moduleId ?? '';
  const { manifest, isPending } = useModule(moduleId);
  const { data: modules = [] } = useModules();
  if (isPending) return <ModuleLoading />;
  if (!manifest) return <NotFoundPage />;
  return (
    <EntityRenderersProvider
      registry={ENTITY_RENDERERS}
      moduleIds={modules.map((module) => module.id)}
    >
      <ModuleOutlet
        manifest={manifest}
        subpath={params._splat ? `/${params._splat}` : '/'}
        registry={MODULE_CHUNKS}
        loading={<ModuleLoading manifest={manifest} />}
        failed={(error, retry) => <PageFailure framed error={error} onRetry={retry} />}
      />
    </EntityRenderersProvider>
  );
}
