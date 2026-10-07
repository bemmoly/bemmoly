import type { ModuleManifest } from '@bemmoly/shared';
import { Suspense, type ReactNode } from 'react';
import type { ChunkRegistry } from './chunks.ts';
import { ErrorBoundary } from './error-boundary.tsx';

interface ModuleOutletProps {
  manifest: ModuleManifest;
  subpath: string;
  registry: ChunkRegistry;
  loading: ReactNode;
  failed: (error: Error, retry: () => void) => ReactNode;
}

/** Mounts a module's lazy chunk inside its own error boundary and suspense fallback. */
export function ModuleOutlet({ manifest, subpath, registry, loading, failed }: ModuleOutletProps) {
  return (
    <ErrorBoundary fallback={failed} resetKey={manifest.id}>
      <Suspense fallback={loading}>{registry.element({ manifest, subpath })}</Suspense>
    </ErrorBoundary>
  );
}
