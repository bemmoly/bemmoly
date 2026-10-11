import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { PortalStore } from './portals.ts';

/** Draws each node view's component into its chrome, inside the host's React tree. */
export function NodeViewPortals({ store }: { store: PortalStore }) {
  const entries = useSyncExternalStore(store.subscribe, store.get);
  return (
    <>
      {entries.map(({ id, element, props, Component }) =>
        createPortal(<Component {...props} />, element, String(id)),
      )}
    </>
  );
}
