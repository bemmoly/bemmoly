/**
 * Cached AI insights for a card: the query hook and the AiSummary-based card. A subpath of its
 * own (`@bemmoly/core-web/ai-insights`) so the insight schemas load with the lazy screens that
 * draw insights, never in the shell's first bundle.
 */
export {
  AiInsightCard,
  InsightActions,
  insightPoints,
  insightSource,
  insightSteps,
} from './ai-insight-card.tsx';
export { useAiInsight, type AiInsightHandle, type AiInsightView } from './use-ai-insight.ts';
