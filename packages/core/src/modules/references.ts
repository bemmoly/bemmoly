import type { ModuleContributions } from './contributions.ts';
import type { EntityRegistry, LinkRegistry, ReferenceGroup } from './registries.ts';
import type { ModuleRegistry } from './registry.ts';

/**
 * The cross-module halves of ctx.entities and ctx.links: what a module registers goes into its
 * own contributions; what it looks up reads every enabled module's, through the registry once
 * loading has finished. Lookups only ever run at request or job time, after boot.
 */
export function createReferenceRegistries(
  into: ModuleContributions,
  peers: () => ModuleRegistry | undefined,
): { entities: EntityRegistry; links: LinkRegistry } {
  const loaded = () => {
    const registry = peers();
    if (!registry) throw new Error('Cross-module lookups run only after every module has loaded');
    return registry;
  };
  return {
    entities: {
      add: (entity) => into.entities.push(entity),
      async resolve(kind, ref, ctx) {
        const definition = loaded()
          .entities()
          .find((entity) => entity.kind === kind);
        if (!definition) return null;
        const summary = await definition.resolve(ref);
        if (!summary) return null;
        if (ctx && !(await definition.canView(ctx, summary.id))) return null;
        return summary;
      },
    },
    links: {
      add: (link) => into.links.push(link),
      addReferenceSource: (source) => into.referenceSources.push(source),
      async referencesTo(ctx, target) {
        const groups: ReferenceGroup[] = [];
        for (const source of loaded().referenceSources()) {
          const items = await source.referencesTo(ctx, target);
          if (items.length === 0) continue;
          groups.push({
            source: source.kind,
            label: source.label,
            moduleId: source.moduleId,
            items,
          });
        }
        return groups;
      },
    },
  };
}
