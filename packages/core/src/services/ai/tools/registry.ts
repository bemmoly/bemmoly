import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '@bemmoly/shared';
import type { AiTool } from '../../../contracts/ai.ts';
import type { AiContribution } from '../../../modules/registries.ts';
import type { RequestContext } from '../../authz/index.ts';
import { isAiToolDefinition } from './define.ts';
import type { AiToolDefinition, RegisteredAiTool } from './types.ts';

export interface AiToolRegistry {
  /** Every registered tool, in module load order. */
  list(): readonly RegisteredAiTool[];
  get(name: string): RegisteredAiTool | undefined;
  /** The tools whose module is enabled and open to this person. */
  available(ctx: RequestContext): Promise<RegisteredAiTool[]>;
}

export interface AiToolSource {
  /** Every module's `ctx.ai.addTool` contributions, with the module that made each. */
  contributions(): readonly (AiContribution & { moduleId: string })[];
  /** Live enabled state; every module counts as enabled without it. */
  isEnabled?: (moduleId: string) => boolean;
}

/** The kernel's view of the tools modules registered; the kernel never imports a module. */
export function createAiToolRegistry(source: AiToolSource): AiToolRegistry {
  const list = (): RegisteredAiTool[] =>
    source
      .contributions()
      .filter((contribution) => isAiToolDefinition(contribution.definition))
      .map((contribution) => ({
        ...(contribution.definition as AiToolDefinition),
        moduleId: contribution.moduleId,
      }));
  return {
    list,
    get: (name) => list().find((tool) => tool.name === name),
    async available(ctx) {
      const enabled = list().filter((tool) => source.isEnabled?.(tool.moduleId) ?? true);
      const modules = [...new Set(enabled.map((tool) => tool.moduleId))];
      const open = new Set<string>();
      for (const moduleId of modules) {
        if (await ctx.authz.canAccess(ctx.actor, moduleId)) open.add(moduleId);
      }
      return enabled.filter((tool) => open.has(tool.moduleId));
    },
  };
}

/** The errors a read tool reports back to the model instead of failing the plan. */
export function isExpectedToolError(error: unknown): error is Error {
  return (
    error instanceof NotFoundError ||
    error instanceof ForbiddenError ||
    error instanceof ValidationError ||
    error instanceof ConflictError
  );
}

/**
 * The AI SDK tool set for one planning call, generated from the definitions: read tools run
 * as the person asking (their result goes back to the model), write tools carry no `execute`,
 * so the facade only records the call and it becomes a plan step.
 */
export function toolSetFor(
  tools: readonly AiToolDefinition[],
  ctx: RequestContext,
): Record<string, AiTool<never>> {
  const set: Record<string, AiTool<never>> = {};
  for (const tool of tools) {
    const generated: AiTool<unknown> =
      tool.kind === 'read'
        ? {
            description: tool.description,
            inputSchema: tool.input,
            execute: async (input) => {
              try {
                return await tool.execute(ctx, input);
              } catch (error) {
                if (isExpectedToolError(error)) return { error: error.message };
                throw error;
              }
            },
          }
        : { description: tool.description, inputSchema: tool.input };
    set[tool.name] = generated as unknown as AiTool<never>;
  }
  return set;
}
