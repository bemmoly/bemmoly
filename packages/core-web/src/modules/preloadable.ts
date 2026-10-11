import { createElement, lazy, useEffect, useState, type ComponentType } from 'react';

export type ComponentLoader<P> = () => Promise<{ default: ComponentType<P> }>;

/** A lazily loaded component that can be loaded ahead of rendering it. */
export interface Preloadable<P> {
  /** The component once loaded; before that a React.lazy that suspends until it is. */
  Component: ComponentType<P>;
  /** Starts loading (once) and resolves when the component can render without suspending. */
  load: () => Promise<unknown>;
  loaded: () => boolean;
}

/**
 * React.lazy with a way round its first suspension. React holds a Suspense boundary's
 * revealed content back until 300 ms after its fallback was shown, so a chunk that arrives in
 * 20 ms still costs 300 ms, and the screen's requests start only after it. Loading first
 * (useLoaded) and rendering the loaded component directly never shows a fallback.
 */
export function preloadable<P extends object>(loader: ComponentLoader<P>): Preloadable<P> {
  let resolved: ComponentType<P> | undefined;
  let pending: Promise<{ default: ComponentType<P> }> | undefined;
  const load = () =>
    (pending ??= loader().then(
      (module) => {
        resolved = module.default;
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        throw error;
      },
    ));
  const Lazy = lazy(load);
  function Component(props: P) {
    // Chosen once per mount, so a lazily mounted screen is not remounted when it resolves.
    const [type] = useState<ComponentType<P>>(() => resolved ?? (Lazy as ComponentType<P>));
    return createElement(type, props);
  }
  return { Component, load, loaded: () => resolved !== undefined };
}

/**
 * True once `target` can render without suspending, and starts loading it. Until then render
 * a placeholder of your own rather than letting Suspense show its fallback. A chunk that fails
 * to load reports true, so the lazy path throws into the nearest error boundary.
 */
export function useLoaded(target: Pick<Preloadable<never>, 'load' | 'loaded'> | null): boolean {
  const [settled, setSettled] = useState<object | null>(null);
  useEffect(() => {
    if (!target || target.loaded()) return undefined;
    let alive = true;
    const done = () => {
      if (alive) setSettled(target);
    };
    target.load().then(done, done);
    return () => {
      alive = false;
    };
  }, [target]);
  return !target || target.loaded() || settled === target;
}
