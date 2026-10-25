import type { ModuleContext } from '@bemmoly/core';
import type { LinksService } from './index.ts';

/** A page and anything under it ("/docs/p/<id>/history"); resolvePage checks the id. */
const PAGE_PATH = /^\/docs\/p\/([^/?#]+)(?:\/|$)/;

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
    fromPath(path) {
      const id = PAGE_PATH.exec(path)?.[1];
      return id ? { id } : null;
    },
    canView: (requestCtx, id) => links.canViewPage(requestCtx, id),
  });
  ctx.links.addReferenceSource({
    kind: 'docs.page',
    label: 'Linked docs',
    referencesTo: (requestCtx, target) => links.referencesTo(requestCtx, target),
    referencesToMany: (requestCtx, targets) => links.referencesToMany(requestCtx, targets),
  });
}
