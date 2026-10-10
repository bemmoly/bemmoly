import { MORNING_BRIEF_PROMPT_FILE } from './brief.ts';

export {
  BRIEF_LOCAL_HOUR,
  createMorningBriefGenerator,
  localClock,
  MORNING_BRIEF_PROMPT_ID,
} from './brief.ts';
export { createInsightRegistry, type InsightRegistry, type ResolvedGenerator } from './registry.ts';
export {
  AI_BRIEF_JOB,
  AI_INSIGHT_JOB,
  createInsightsService,
  type InsightsService,
  type InsightsServiceDeps,
} from './service.ts';
export { createInsightStore, type InsightRow, type InsightStore } from './store.ts';
export {
  defineInsightGenerator,
  isInsightGenerator,
  type AiInsightGenerator,
  type AiInsightStampOptions,
} from './types.ts';

/** The kernel's own prompt files (ids start with "ai."), loaded by the prompt service. */
export const INSIGHT_PROMPT_FILES: readonly string[] = [MORNING_BRIEF_PROMPT_FILE];
