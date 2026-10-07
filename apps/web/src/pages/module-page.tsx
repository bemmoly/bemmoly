import { ModuleOutlet } from '@bemmoly/core-web';
import { useParams } from '@tanstack/react-router';
import { PageFailure } from '../components/page-failure.tsx';
import { useModule } from '../hooks/use-modules.ts';
import { MODULE_CHUNKS } from '../lib/module-chunks.ts';
import { Loading } from '../components/form.tsx';
import { NotFoundPage } from './not-found-page.tsx';

/** A module's area: its lazy chunk under /<module id>, inside its own error boundary. */
export function ModulePage() {
  const params = useParams({ strict: false }) as { moduleId?: string; _splat?: string };
  const moduleId = params.moduleId ?? '';
  const { manifest, isPending } = useModule(moduleId);
  if (isPending) return <Loading lines={4} label="Loading module" />;
  if (!manifest) return <NotFoundPage />;
  return (
    <ModuleOutlet
      manifest={manifest}
      subpath={params._splat ? `/${params._splat}` : '/'}
      registry={MODULE_CHUNKS}
      loading={<Loading lines={4} label={`Loading ${manifest.id}`} />}
      failed={(error, retry) => <PageFailure error={error} onRetry={retry} />}
    />
  );
}
