import type { AiInsightKind } from '@bemmoly/shared';
import type { ModuleRegistry } from '../../../modules/registry.ts';
import { isContextBuilderDefinition } from '../context/index.ts';
import type {
  AiActivitySource,
  AiContextBuilderDefinition,
  AiTargetContextBuilder,
} from '../context/types.ts';
import { isInsightGenerator, type AiInsightGenerator } from './types.ts';

export interface InsightRegistryDeps {
  modules: ModuleRegistry;
  isEnabled(moduleId: string): boolean;
  /** The kernel's own builders (the activity context), by name. */
  builders?: Readonly<Record<string, AiContextBuilderDefinition>>;
  generators?: readonly AiInsightGenerator[];
}

export interface ResolvedGenerator {
  generator: AiInsightGenerator;
  builder: AiTargetContextBuilder;
  /** The module that registered the generator, or "ai" for the kernel. */
  owner: string;
}

/**
 * Reads the generators and context builders enabled modules registered, on every call, so a
 * module turned off stops answering at once. Kernel entries come first and cannot be shadowed.
 */
export function createInsightRegistry(deps: InsightRegistryDeps) {
  const enabled = () => deps.modules.list().filter(({ module }) => deps.isEnabled(module.id));

  const builderNamed = (name: string): AiContextBuilderDefinition | null => {
    const own = deps.builders?.[name];
    if (own) return own;
    for (const { contributions } of enabled()) {
      const found = contributions.aiContextBuilders.find((entry) => entry.name === name);
      if (found && isContextBuilderDefinition(found.definition)) return found.definition;
    }
    return null;
  };

  return {
    resolve(kind: AiInsightKind): ResolvedGenerator | null {
      const candidates: { generator: AiInsightGenerator; owner: string }[] = [
        ...(deps.generators ?? []).map((generator) => ({ generator, owner: 'ai' })),
        ...enabled().flatMap(({ module, contributions }) =>
          contributions.aiInsightGenerators
            .map((entry) => entry.definition)
            .filter(isInsightGenerator)
            .map((generator) => ({ generator, owner: module.id })),
        ),
      ];
      const match = candidates.find((candidate) => candidate.generator.kind === kind);
      if (!match) return null;
      const builder = builderNamed(match.generator.builder);
      if (!builder || builder.type !== 'target') return null;
      return { generator: match.generator, builder, owner: match.owner };
    },

    activitySources(): AiActivitySource[] {
      return enabled().flatMap(({ contributions }) =>
        contributions.aiContextBuilders
          .map((entry) => entry.definition)
          .filter(isContextBuilderDefinition)
          .filter((definition): definition is AiActivitySource => definition.type === 'activity'),
      );
    },
  };
}

export type InsightRegistry = ReturnType<typeof createInsightRegistry>;
