import type { ModuleManifest } from '@bemmoly/shared';
import { Suspense, type ReactNode } from 'react';
import type { ChunkRegistry } from './chunks.ts';
import { ErrorBoundary } from './error-boundary.tsx';
import { useLoaded } from './preloadable.ts';

interface ModuleOutletProps {
  manifest: ModuleManifest;
  subpath: string;
  registry: ChunkRegistry;
  loading: ReactNode;
  failed: (error: Error, retry: () => void) => ReactNode;
}

/**
 * Mounts a module's lazy chunk inside its own error boundary. The chunk loads before it
 * renders, with `loading` drawn meanwhile, so no Suspense fallback holds the screen back.
 */
export function ModuleOutlet({ manifest, subpath, registry, loading, failed }: ModuleOutletProps) {
  const ready = useLoaded(registry.resolve(manifest.id));
  return (
    <ErrorBoundary fallback={failed} resetKey={manifest.id}>
      <Suspense fallback={loading}>
        {ready ? registry.element({ manifest, subpath }) : loading}
      </Suspense>
    </ErrorBoundary>
  );
}
