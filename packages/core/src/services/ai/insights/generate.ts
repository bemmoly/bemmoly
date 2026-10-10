import { AI_INSIGHT_OUTPUT_SCHEMAS, AI_REALTIME_KINDS, ProviderError } from '@bemmoly/shared';
import type { z } from 'zod';
import type { AiFacade, AiPolicy } from '../../../contracts/ai.ts';
import type { RealtimePublisher } from '../../../contracts/realtime.ts';
import { isAiRefusal } from '../refusals.ts';
import { keepKnownCitations } from '../context/citations.ts';
import type { AiBuiltContext } from '../context/types.ts';
import type { ResolvedGenerator } from './registry.ts';
import type { InsightRow, InsightStore } from './store.ts';

export interface RegenerateDeps {
  ai: AiFacade;
  store: InsightStore;
  realtime: RealtimePublisher;
  now: () => Date;
}

const FAILURE_COPY = 'Something went wrong while writing this';

/**
 * The cache key a view compares with the stored row. With a `stamp` it is that; otherwise
 * the context's hash as the next view will build it, which is with `since` set to the
 * generation time (so "history since the last summary" is empty until something happens).
 */
export async function cacheKeyOf(
  resolved: ResolvedGenerator,
  targetId: string,
  policy: AiPolicy,
  now: Date,
  since: Date | null,
): Promise<string | null> {
  const { generator, builder } = resolved;
  if (generator.stamp) return generator.stamp(targetId, { policy, now });
  const context = await builder.build(targetId, { policy, now, since });
  return context?.hash ?? null;
}

async function outputOf(
  deps: RegenerateDeps,
  resolved: ResolvedGenerator,
  context: AiBuiltContext,
): Promise<{ output: unknown; runId: string | null }> {
  const { generator } = resolved;
  const empty = generator.emptyOutput?.(context);
  if (empty !== undefined && empty !== null) return { output: empty, runId: null };
  const rendered = await deps.ai.renderPrompt(generator.promptId, {
    ...context.variables,
    context: context.text,
  });
  const result = await deps.ai.generate({
    role: rendered.role,
    purpose: generator.purpose,
    system: rendered.system,
    prompt: rendered.prompt,
    promptRef: rendered.promptRef,
    schema: AI_INSIGHT_OUTPUT_SCHEMAS[generator.kind] as z.ZodType<unknown>,
    actor: null,
  });
  return { output: result.object, runId: result.runId };
}

/**
 * Builds the context, asks the model (structured output only), keeps the citations the
 * context offered, stores the row and tells the target's audience. Returns null when there is
 * nothing to do: AI off, the target gone or excluded. A provider failure or refusal is stored
 * as "failed" with honest copy, so the card can offer Try again; a bug is stored and rethrown.
 */
export async function regenerate(
  deps: RegenerateDeps,
  resolved: ResolvedGenerator,
  targetId: string,
  options: { force?: boolean } = {},
): Promise<InsightRow | null> {
  const { generator, builder } = resolved;
  const policy = await deps.ai.policy(null);
  if (!policy.enabled) return null;
  const previous = await deps.store.find(builder.targetKind, targetId, generator.kind);
  const now = deps.now();
  let context: AiBuiltContext | null;
  try {
    context = await builder.build(targetId, { policy, now, since: previous?.generatedAt ?? null });
  } catch (error) {
    if (isAiRefusal(error)) return null;
    throw error;
  }
  if (!context) return null;
  const key = (await cacheKeyOf(resolved, targetId, policy, now, now)) ?? context.hash;
  if (!options.force && previous?.status === 'ready' && previous.inputHash === key) {
    return previous;
  }
  const where = { targetKind: builder.targetKind, targetId, kind: generator.kind };
  const announce = () =>
    deps.realtime.publish({
      kind: AI_REALTIME_KINDS.insight,
      ids: [targetId],
      ...context.audience,
    });
  try {
    const { output, runId } = await outputOf(deps, resolved, context);
    const kept = keepKnownCitations(output, context.citations);
    const saved = await deps.store.saveReady({
      ...where,
      inputHash: key,
      content: { output: kept.output, citations: kept.citations, source: context.source },
      runId,
      generatedAt: now,
    });
    await generator.afterStore?.(targetId, kept.output, context);
    await announce();
    return saved;
  } catch (error) {
    const expected = isAiRefusal(error) || error instanceof ProviderError;
    const message = expected ? (error as Error).message.slice(0, 300) : FAILURE_COPY;
    const saved = await deps.store.saveFailed({ ...where, inputHash: key, error: message });
    await announce();
    if (!expected) throw error;
    return saved;
  }
}
