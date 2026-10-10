import type { AiContribution } from '../../../modules/registries.ts';
import type { AiContextBuilderDefinition } from './types.ts';

export {
  ACTIVITY_CONTEXT_BUILDER,
  activityWindowStart,
  createActivityContextBuilder,
  type ActivityContextDeps,
} from './activity.ts';
export { keepKnownCitations } from './citations.ts';
export type {
  AiActivityOptions,
  AiActivitySource,
  AiBuiltContext,
  AiContextAudience,
  AiContextBuilderDefinition,
  AiContextOptions,
  AiRelatedSource,
  AiRelatedTarget,
  AiTargetContextBuilder,
} from './types.ts';
export {
  bodyAllowedUnder,
  clip,
  createContextWriter,
  DEFAULT_BODY_CHARS,
  DEFAULT_CONTEXT_CHARS,
  excludedUnder,
  type ContextChunk,
  type ContextWriter,
  type ContextWriterOptions,
} from './writer.ts';

/**
 * The contribution a module passes to `ctx.ai.addContextBuilder`. The name is namespaced by
 * module ("work.issue"); insight generators name the builder they read.
 */
export function defineContextBuilder(
  name: string,
  description: string,
  definition: AiContextBuilderDefinition,
): AiContribution {
  return { name, description, definition };
}

export function isContextBuilderDefinition(value: unknown): value is AiContextBuilderDefinition {
  if (value === null || typeof value !== 'object') return false;
  const { type } = value as { type?: unknown };
  if (type === 'target') return typeof (value as { build?: unknown }).build === 'function';
  if (type === 'activity' || type === 'related') {
    return typeof (value as { collect?: unknown }).collect === 'function';
  }
  return false;
}
