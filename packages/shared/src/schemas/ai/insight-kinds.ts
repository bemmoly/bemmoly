/**
 * The insight kinds and the event names around them, as plain values: the shell's bundle
 * needs these (realtime routing), while the schemas live behind `@bemmoly/shared/ai-insights`
 * so they load only with the screens that draw insights.
 */

export const AI_INSIGHT_KINDS = [
  'issue_summary',
  'page_tldr',
  'sprint_pulse',
  'morning_brief',
  'consistency',
] as const;
export type AiInsightKind = (typeof AI_INSIGHT_KINDS)[number];

/** The realtime message a finished (or failed) regeneration publishes; ids hold the target. */
export const AI_REALTIME_KINDS = { insight: 'ai.insight' } as const;

/**
 * On the event bus: `requested` asks the kernel for a fresh insight; `sourceChanged` tells
 * other modules that records their insights read changed (Work's issues, for the pages that
 * name them), without either module importing the other.
 */
export const AI_INSIGHT_EVENT_KINDS = {
  requested: 'ai.insight.requested',
  sourceChanged: 'ai.source.changed',
} as const;
