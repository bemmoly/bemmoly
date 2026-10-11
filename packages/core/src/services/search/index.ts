import { ForbiddenError, type SearchRequestQuery, type SearchResult } from '@bemmoly/shared';
import type { FromModule } from '../../modules/registry.ts';
import type { SearchProviderDefinition } from '../../modules/registries.ts';
import type { RequestContext } from '../authz/index.ts';

export interface SearchServiceDeps {
  /** Every provider modules registered, with the module that registered it. */
  providers(): FromModule<SearchProviderDefinition>[];
  /** Live enabled state; a disabled module's provider is not asked. */
  isEnabled(moduleId: string): boolean;
}

/**
 * ⌘K's server search: asks every provider of an enabled module the person
 * may open, in registration order, and labels each answer with its group.
 * A provider that refuses the person (a capability they lack) contributes
 * nothing; any other failure fails the search, as it should be seen.
 */
export function createSearchService(deps: SearchServiceDeps) {
  return {
    async search(ctx: RequestContext, query: SearchRequestQuery): Promise<SearchResult[]> {
      const reachable = await ctx.authz.modulesFor(ctx.actor);
      const asked = deps
        .providers()
        .filter(
          (provider) =>
            deps.isEnabled(provider.moduleId) &&
            reachable.has(provider.moduleId) &&
            (!query.kinds || query.kinds.includes(provider.kind)),
        );
      const answers = await Promise.all(
        asked.map(async (provider) => {
          try {
            const found = await provider.search(ctx, { q: query.q, limit: query.limit });
            return found
              .slice(0, query.limit)
              .map((result) => ({ ...result, kind: provider.kind, group: provider.label }));
          } catch (error) {
            if (error instanceof ForbiddenError) return [];
            throw error;
          }
        }),
      );
      return answers.flat();
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
