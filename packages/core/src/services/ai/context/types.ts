import type { AiCitation, AiInsightSource } from '@bemmoly/shared';
import type { AiPolicy } from '../../../contracts/ai.ts';
import type { RequestContext } from '../../authz/index.ts';
import type { ContextWriter } from './writer.ts';

/**
 * Context builders (tech design 11.3). No feature hands a model raw rows: a builder writes a
 * bounded, ordered context where every chunk carries a citation token ("[c3]") mapped to an
 * object and a location. Builders register through `ctx.ai.addContextBuilder`, with one of
 * the definitions below as the contribution's `definition`.
 */

/** Where a target lives, for realtime delivery of its regenerated insight. */
export interface AiContextAudience {
  projectId?: string;
  spaceId?: string;
  /** A personal insight (the morning brief) goes to this person's sockets only. */
  userId?: string;
}

export interface AiBuiltContext {
  /** The ordered context the prompt's {{context}} receives. */
  text: string;
  citations: AiCitation[];
  source: AiInsightSource;
  /** sha256 of everything the builder sent: the cache key's second half. */
  hash: string;
  audience: AiContextAudience;
  /** Extra prompt variables the builder knows (the issue key, the page title). */
  variables: Record<string, string>;
}

export interface AiContextOptions {
  policy: AiPolicy;
  now: Date;
  /** When the cached insight was generated: "history since the last summary". */
  since: Date | null;
  /**
   * Asks other enabled modules what they know about a record, written into the same writer
   * (an issue's linked pages and their TL;DRs, from Docs). Absent outside the insight service.
   */
  related?: (writer: ContextWriter, target: AiRelatedTarget) => Promise<void>;
}

export interface AiRelatedTarget {
  kind: string;
  id: string;
}

/** Builds context for one record (an issue, a sprint, a page). */
export interface AiTargetContextBuilder {
  type: 'target';
  /** What the target is: "issue", "sprint", "page". */
  targetKind: string;
  /** Whether the person may open the target; the insight is refused otherwise. */
  canView(ctx: RequestContext, targetId: string): Promise<boolean>;
  /**
   * The context, or null when the target is gone. Throws the `excluded` refusal when the
   * target's own space or project is excluded from AI.
   */
  build(targetId: string, options: AiContextOptions): Promise<AiBuiltContext | null>;
  /** The last change to anything the context reads, for quiet-period triggers. */
  lastChangedAt?(targetId: string): Promise<Date | null>;
}

export interface AiActivityOptions {
  userId: string;
  since: Date;
  now: Date;
  policy: AiPolicy;
}

/**
 * One module's share of the activity context: what changed since `since` in the projects or
 * spaces the person can open, written into the shared writer so citations number on.
 */
export interface AiActivitySource {
  type: 'activity';
  collect(writer: ContextWriter, options: AiActivityOptions): Promise<void>;
}

/**
 * One module's knowledge about another module's records, so builders stay inside their own
 * module: Docs answers for an issue with the pages that link it and their TL;DRs.
 */
export interface AiRelatedSource {
  type: 'related';
  targetKinds: readonly string[];
  collect(
    writer: ContextWriter,
    target: AiRelatedTarget,
    options: Omit<AiContextOptions, 'related'>,
  ): Promise<void>;
}

export type AiContextBuilderDefinition =
  AiTargetContextBuilder | AiActivitySource | AiRelatedSource;
