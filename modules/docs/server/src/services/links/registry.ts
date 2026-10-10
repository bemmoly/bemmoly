import type { ModuleContext } from '@bemmoly/core';
import type { LinksService } from './index.ts';

/**
 * Docs in the kernel's reference registries: pages as an entity any module can resolve by id
 * and check access to, and "Linked docs" as a reference source Work (or anything else) can ask
 * about one of its records, all without importing this module.
 */
export function registerDocsReferences(
  ctx: Pick<ModuleContext, 'entities' | 'links'>,
  links: LinksService,
): void {
  ctx.entities.add({
    kind: 'page',
    renderer: 'docs.page',
    resolve: (ref) => links.resolvePage(ref),
    canView: (requestCtx, id) => links.canViewPage(requestCtx, id),
  });
  ctx.links.addReferenceSource({
    kind: 'docs.page',
    label: 'Linked docs',
    referencesTo: (requestCtx, target) => links.referencesTo(requestCtx, target),
  });
}
