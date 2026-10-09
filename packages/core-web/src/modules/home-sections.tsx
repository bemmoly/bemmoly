import type { ModuleManifest } from '@bemmoly/shared';
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from './error-boundary.tsx';

/** What a module's Home section receives: its own manifest, as its chunk does. */
export interface HomeSectionProps {
  manifest: ModuleManifest;
}

export type HomeSection = LazyExoticComponent<ComponentType<HomeSectionProps>>;
export type HomeSectionLoader = () => Promise<{ default: ComponentType<HomeSectionProps> }>;

/**
 * The Home page's extension point: a module that ships `web/src/home.tsx`
 * contributes the section it exports by default, loaded lazily on its own
 * so Home never waits for a module's screens. Sections are created once per
 * module id so React keeps their identity across renders.
 */
export function createHomeSectionRegistry(loaders: Readonly<Record<string, HomeSectionLoader>>) {
  const cache = new Map<string, HomeSection>();
  return {
    has: (moduleId: string) => moduleId in loaders,
    resolve(moduleId: string): HomeSection | null {
      const loader = loaders[moduleId];
      if (!loader) return null;
      let section = cache.get(moduleId);
      if (!section) {
        section = lazy(loader);
        cache.set(moduleId, section);
      }
      return section;
    },
  };
}

export type HomeSectionRegistry = ReturnType<typeof createHomeSectionRegistry>;

interface HomeSectionsProps {
  /** The modules this person can open, in the order Home lists them. */
  modules: readonly ModuleManifest[];
  registry: HomeSectionRegistry;
  /** Shown while a section's code loads. */
  loading: ReactNode;
  /** Shown in place of a section that failed, so the rest of Home still works. */
  failed: (manifest: ModuleManifest, error: Error, retry: () => void) => ReactNode;
}

/** Every contributed section, each inside its own error boundary and suspense fallback. */
export function HomeSections({ modules, registry, loading, failed }: HomeSectionsProps) {
  return (
    <>
      {modules.map((manifest) => {
        const Section = registry.resolve(manifest.id);
        if (!Section) return null;
        return (
          <ErrorBoundary
            key={manifest.id}
            resetKey={manifest.version}
            fallback={(error, retry) => failed(manifest, error, retry)}
          >
            <Suspense fallback={loading}>
              <Section manifest={manifest} />
            </Suspense>
          </ErrorBoundary>
        );
      })}
    </>
  );
}
