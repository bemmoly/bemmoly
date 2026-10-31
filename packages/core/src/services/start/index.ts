import { ForbiddenError, moduleStartSummarySchema, type StartSummary } from '@bemmoly/shared';
import type { FromModule } from '../../modules/registry.ts';
import type { StartSourceDefinition } from '../../modules/start.ts';
import type { RequestContext } from '../authz/index.ts';

export interface StartServiceDeps {
  /** Every module's `summaryForUser`, with the module that registered it. */
  sources(): FromModule<StartSourceDefinition>[];
  /** Live enabled state; a disabled module is not asked. */
  isEnabled(moduleId: string): boolean;
}

/**
 * The start page's summaries: one per enabled module the person may open, in registration
 * order. A module that refuses the person (a capability they lack) is left out, as ⌘K leaves
 * out its provider; any other failure fails the page, as it should be seen.
 */
export function createStartService(deps: StartServiceDeps) {
  return {
    async summaries(ctx: RequestContext): Promise<StartSummary[]> {
      const reachable = await ctx.authz.modulesFor(ctx.actor);
      const asked = deps
        .sources()
        .filter((source) => deps.isEnabled(source.moduleId) && reachable.has(source.moduleId));
      const answers = await Promise.all(
        asked.map(async (source): Promise<StartSummary | null> => {
          try {
            const summary = moduleStartSummarySchema.parse(await source.summaryForUser(ctx));
            return { moduleId: source.moduleId, ...summary };
          } catch (error) {
            if (error instanceof ForbiddenError) return null;
            throw error;
          }
        }),
      );
      return answers.filter((answer) => answer !== null);
    },
  };
}

export type StartService = ReturnType<typeof createStartService>;
