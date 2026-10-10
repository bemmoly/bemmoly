import type { ModuleContributions } from './contributions.ts';
import type { RequestContext } from '../services/authz/index.ts';
import type {
  EntityDefinition,
  EntityLookup,
  EntityRegistry,
  EntitySummary,
  LinkRegistry,
  ReferenceGroup,
} from './registries.ts';
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
  const definitionOf = (kind: string) =>
    loaded()
      .entities()
      .find((entity) => entity.kind === kind);
  const resolveOne = async (
    definition: EntityDefinition,
    ref: EntityLookup,
    ctx?: RequestContext,
  ) => {
    const summary = await definition.resolve(ref);
    if (!summary) return null;
    if (ctx && !(await definition.canView(ctx, summary.id))) return null;
    return summary;
  };
  return {
    entities: {
      add: (entity) => into.entities.push(entity),
      async resolve(kind, ref, ctx) {
        const definition = definitionOf(kind);
        return definition ? resolveOne(definition, ref, ctx) : null;
      },
      async resolveMany(kind, refs, ctx) {
        const definition = definitionOf(kind);
        if (!definition || refs.length === 0) return [];
        const found = definition.resolveMany
          ? await definition.resolveMany(refs, ctx)
          : await Promise.all(refs.map((ref) => resolveOne(definition, ref, ctx)));
        const unique = new Map<string, EntitySummary>();
        for (const summary of found) if (summary) unique.set(summary.id, summary);
        return [...unique.values()];
      },
      has: (kind) => definitionOf(kind) !== undefined,
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
