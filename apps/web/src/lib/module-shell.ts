import {
  createDialogRegistry,
  createSidebarRegistry,
  type ModuleCreateLoader,
  type ModuleSidebarLoader,
} from '@bemmoly/core-web';

/**
 * What each module adds to the frame, discovered by folder as the module chunks are: a module
 * with `web/src/sidebar.tsx` draws its live sidebar rows, one with `web/src/create.tsx` opens
 * its create dialogs in place. Each is its own small file, so the sidebar and the New button
 * never wait for a module's screens. The shell never names a module.
 */
const SIDEBARS = import.meta.glob<Awaited<ReturnType<ModuleSidebarLoader>>>(
  '../../../../modules/*/web/src/sidebar.tsx',
);
const CREATES = import.meta.glob<Awaited<ReturnType<ModuleCreateLoader>>>(
  '../../../../modules/*/web/src/create.tsx',
);

function byModule<T>(entries: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [path, load] of Object.entries(entries)) {
    const moduleId = /\/modules\/([^/]+)\/web\//.exec(path)?.[1];
    if (moduleId) out[moduleId] = load;
  }
  return out;
}

export const MODULE_SIDEBARS = createSidebarRegistry(byModule(SIDEBARS));
export const MODULE_CREATES = createDialogRegistry(byModule(CREATES));
