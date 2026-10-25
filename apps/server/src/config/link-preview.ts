import { createLinkPreviews, type ModuleRegistry } from '@bemmoly/core';
import type { LinkPreviewLookup } from '../middlewares/static-web.ts';
import type { DataKernel } from './kernel.ts';

/** Shared links name their page or issue, from every enabled module's entities. */
export function wireLinkPreview(
  modules: ModuleRegistry,
  kernel: Pick<DataKernel, 'settings' | 'moduleState'>,
): LinkPreviewLookup {
  const previews = createLinkPreviews({
    entities: () => modules.entities(),
    isEnabled: (moduleId) => kernel.moduleState.isEnabled(moduleId),
    settings: kernel.settings,
  });
  return (path) => previews.forPath(path);
}
