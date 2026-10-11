import type { AiInsightKind, AiPurpose } from '@bemmoly/shared';
import type { AiPolicy } from '../../../contracts/ai.ts';
import type { AiContribution } from '../../../modules/registries.ts';
import type { AiBuiltContext } from '../context/types.ts';

export interface AiInsightStampOptions {
  policy: AiPolicy;
  now: Date;
}

/**
 * How one kind of insight is made: which context builder it reads, which prompt it renders,
 * and when the cache counts as stale. Registered through `ctx.ai.addInsightGenerator`.
 */
export interface AiInsightGenerator {
  kind: AiInsightKind;
  /** The context builder's registered name ("work.issue"). */
  builder: string;
  /** The prompt file's id ("work.issue_summary"); its role picks the model. */
  promptId: string;
  purpose: AiPurpose;
  /**
   * A cheap staleness key, used instead of the context's hash: the page text's hash for a
   * TL;DR, the person's local date for the morning brief. Null means "not available".
   */
  stamp?(targetId: string, options: AiInsightStampOptions): Promise<string | null>;
  /** Whether a view that finds the cache stale queues a regeneration (default true). */
  refreshOnView?: boolean;
  /**
   * The output to store without calling a model when the context holds nothing to say
   * (a page that names no issues has no contradictions). Null: ask the model.
   */
  emptyOutput?(context: AiBuiltContext): unknown;
  /** Runs once a fresh output is stored, e.g. Docs copies the TL;DR text onto the page. */
  afterStore?(targetId: string, output: unknown, context: AiBuiltContext): Promise<void>;
}

/** The contribution a module passes to `ctx.ai.addInsightGenerator`. */
export function defineInsightGenerator(
  description: string,
  definition: AiInsightGenerator,
): AiContribution {
  return { name: definition.kind, description, definition };
}

export function isInsightGenerator(value: unknown): value is AiInsightGenerator {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<AiInsightGenerator>;
  return (
    typeof candidate.kind === 'string' &&
    typeof candidate.builder === 'string' &&
    typeof candidate.promptId === 'string'
  );
}
