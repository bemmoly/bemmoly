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

/**
 * main: the wide column ("My issues"). aside: the narrow column under the inbox preview
 * ("Sprint at a glance").
 */
export type HomeSlot = 'main' | 'aside';

export type HomeSection = LazyExoticComponent<ComponentType<HomeSectionProps>>;
export type HomeSectionLoader = () => Promise<{
  default: ComponentType<HomeSectionProps>;
  /** The module's card for the narrow column, if it has one. */
  HomeAside?: ComponentType<HomeSectionProps>;
}>;

function Nothing() {
  return null;
}

/**
 * The Home page's extension point: a module that ships `web/src/home.tsx` contributes the
 * section it exports by default to the main column, and `HomeAside` to the narrow one, loaded
 * lazily on their own so Home never waits for a module's screens. Sections are created once
 * per module and slot so React keeps their identity across renders.
 */
export function createHomeSectionRegistry(loaders: Readonly<Record<string, HomeSectionLoader>>) {
  const cache = new Map<string, HomeSection>();
  return {
    has: (moduleId: string) => moduleId in loaders,
    resolve(moduleId: string, slot: HomeSlot = 'main'): HomeSection | null {
      const loader = loaders[moduleId];
      if (!loader) return null;
      const key = `${moduleId}:${slot}`;
      let section = cache.get(key);
      if (!section) {
        section = lazy(async () => {
          const loaded = await loader();
          return { default: (slot === 'main' ? loaded.default : loaded.HomeAside) ?? Nothing };
        });
        cache.set(key, section);
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
  slot?: HomeSlot;
  /** Shown while a section's code loads. */
  loading: ReactNode;
  /** Shown in place of a section that failed, so the rest of Home still works. */
  failed: (manifest: ModuleManifest, error: Error, retry: () => void) => ReactNode;
}

/** Every contributed section, each inside its own error boundary and suspense fallback. */
export function HomeSections({
  modules,
  registry,
  slot = 'main',
  loading,
  failed,
}: HomeSectionsProps) {
  return (
    <>
      {modules.map((manifest) => {
        const Section = registry.resolve(manifest.id, slot);
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
