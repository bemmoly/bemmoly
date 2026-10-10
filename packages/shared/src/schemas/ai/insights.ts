import { z } from 'zod';
import { aiFeedbackSchema } from './enums.ts';

/**
 * Cached AI content (tech design 11.3 and 11.5): what a model wrote about one target, the
 * citations it may point at, and the state of the cache. The model answers with one of the
 * output schemas below; the server keeps only citations the context really offered, so a
 * point with no valid citation is shown as unsourced rather than hidden.
 */

export const AI_INSIGHT_KINDS = [
  'issue_summary',
  'page_tldr',
  'sprint_pulse',
  'morning_brief',
  'consistency',
] as const;
export const aiInsightKindSchema = z.enum(AI_INSIGHT_KINDS);
export type AiInsightKind = z.infer<typeof aiInsightKindSchema>;

/** fresh: matches its inputs. refreshing: stale, a new one is on its way. pending: none yet. */
export const AI_INSIGHT_STATES = ['ready', 'refreshing', 'pending', 'failed'] as const;
export const aiInsightStateSchema = z.enum(AI_INSIGHT_STATES);
export type AiInsightState = z.infer<typeof aiInsightStateSchema>;

/** The realtime message a finished (or failed) regeneration publishes; ids hold the target. */
export const AI_REALTIME_KINDS = { insight: 'ai.insight' } as const;

/** Modules ask the kernel for a fresh insight through this event on the bus. */
export const AI_INSIGHT_EVENT_KINDS = { requested: 'ai.insight.requested' } as const;

export const aiInsightRequestedPayloadSchema = z.object({
  kind: aiInsightKindSchema,
  targetIds: z.array(z.uuid()).min(1).max(200),
  /** Wait this long after the last change before regenerating (the sprint pulse's 5 min). */
  quietSeconds: z.number().int().min(0).max(86_400).default(0),
});
export type AiInsightRequestedPayload = z.input<typeof aiInsightRequestedPayloadSchema>;

/** "c1" to "c999": the token a context block carries and the model cites. */
export const aiCitationIdSchema = z.string().regex(/^c[1-9][0-9]{0,2}$/);

export const aiCitationSchema = z.object({
  id: aiCitationIdSchema,
  /** What it points at: issue, comment, history, page, section, sprint, pr. */
  kind: z.string().min(1).max(40),
  objectId: z.string().min(1).max(128),
  /** How a link reads: "PLT-204", "Jonas M.'s comment", "Rollback". */
  label: z.string().min(1).max(200),
  /** Where inside the object: a heading, a field, a date. */
  location: z.string().max(200).nullable(),
  href: z.string().max(500).nullable(),
});
export type AiCitation = z.infer<typeof aiCitationSchema>;

/** One sentence the model writes, with the citations it rests on. Empty cites: unsourced. */
export const aiCitedPointSchema = z.object({
  text: z.string().min(1).max(600),
  cites: z.array(aiCitationIdSchema).max(8),
});
export type AiCitedPoint = z.infer<typeof aiCitedPointSchema>;

/** A step the reader may take: a link to the cited object, never an action run for them. */
export const aiNextStepSchema = z.object({
  label: z.string().min(1).max(60),
  cite: aiCitationIdSchema,
});
export type AiNextStep = z.infer<typeof aiNextStepSchema>;

export const issueSummaryOutputSchema = z.object({
  points: z.array(aiCitedPointSchema).min(1).max(5),
  next: z.array(aiNextStepSchema).max(2),
});
export type IssueSummaryOutput = z.infer<typeof issueSummaryOutputSchema>;

export const pageTldrOutputSchema = z.object({
  points: z.array(aiCitedPointSchema).min(1).max(4),
});
export type PageTldrOutput = z.infer<typeof pageTldrOutputSchema>;

export const SPRINT_RISKS = ['on_track', 'at_risk', 'off_track'] as const;
export const sprintPulseOutputSchema = z.object({
  risk: z.enum(SPRINT_RISKS),
  headline: aiCitedPointSchema,
  next: z.array(aiNextStepSchema).max(2),
});
export type SprintPulseOutput = z.infer<typeof sprintPulseOutputSchema>;

export const morningBriefOutputSchema = z.object({
  points: z.array(aiCitedPointSchema).max(6),
  next: z.array(aiNextStepSchema).max(3),
});
export type MorningBriefOutput = z.infer<typeof morningBriefOutputSchema>;

/** One contradiction between a page and an issue it names: the strict consistency schema. */
export const consistencyFindingSchema = z.object({
  claim: z.string().min(1).max(400),
  /** The heading the paragraph sits under (null before the first heading) and its index. */
  location: z.object({
    heading: z.string().max(200).nullable(),
    paragraph: z.number().int().min(0).max(10_000),
  }),
  issueKey: z.string().min(1).max(32),
  field: z.string().min(1).max(60),
  issueValue: z.string().max(400),
  confidence: z.number().min(0).max(1),
  cites: z.array(aiCitationIdSchema).max(4),
});
export type ConsistencyFinding = z.infer<typeof consistencyFindingSchema>;

export const consistencyOutputSchema = z.object({
  findings: z.array(consistencyFindingSchema).max(10),
});
export type ConsistencyOutput = z.infer<typeof consistencyOutputSchema>;

/** What the AI read, for "from 14 comments, 2 PRs, 1 doc". */
export const aiInsightSourceSchema = z.object({
  counts: z.record(z.string(), z.number().int().nonnegative()),
  /** Whether bodies were left out (share content off, an exclusion or an opt-out). */
  titlesOnly: z.boolean(),
});
export type AiInsightSource = z.infer<typeof aiInsightSourceSchema>;

const envelope = <Output extends z.ZodType>(output: Output) =>
  z.object({
    output,
    citations: z.array(aiCitationSchema),
    source: aiInsightSourceSchema,
  });

const insightBase = z.object({
  /** Null until the first regeneration stores a row. */
  id: z.uuid().nullable(),
  targetKind: z.string(),
  targetId: z.uuid(),
  state: aiInsightStateSchema,
  /** Plain words for a failed regeneration; the card says "Couldn't get a summary". */
  error: z.string().nullable(),
  generatedAt: z.iso.datetime().nullable(),
  feedback: aiFeedbackSchema.nullable(),
});

export const aiInsightSchema = z.discriminatedUnion('kind', [
  insightBase.extend({
    kind: z.literal('issue_summary'),
    content: envelope(issueSummaryOutputSchema).nullable(),
  }),
  insightBase.extend({
    kind: z.literal('page_tldr'),
    content: envelope(pageTldrOutputSchema).nullable(),
  }),
  insightBase.extend({
    kind: z.literal('sprint_pulse'),
    content: envelope(sprintPulseOutputSchema).nullable(),
  }),
  insightBase.extend({
    kind: z.literal('morning_brief'),
    content: envelope(morningBriefOutputSchema).nullable(),
  }),
  insightBase.extend({
    kind: z.literal('consistency'),
    content: envelope(consistencyOutputSchema).nullable(),
  }),
]);
export type AiInsight = z.infer<typeof aiInsightSchema>;
export type AiInsightOf<Kind extends AiInsightKind> = Extract<AiInsight, { kind: Kind }>;

export const AI_INSIGHT_OUTPUT_SCHEMAS = {
  issue_summary: issueSummaryOutputSchema,
  page_tldr: pageTldrOutputSchema,
  sprint_pulse: sprintPulseOutputSchema,
  morning_brief: morningBriefOutputSchema,
  consistency: consistencyOutputSchema,
} as const;

export const aiInsightParamsSchema = z.object({
  kind: aiInsightKindSchema,
  targetId: z.uuid(),
});

export const aiInsightFeedbackParamsSchema = z.object({ id: z.uuid() });
export const aiInsightFeedbackBodySchema = z.object({ feedback: aiFeedbackSchema });

export const aiInsightResponseSchema = z.object({ insight: aiInsightSchema });
export type AiInsightResponse = z.infer<typeof aiInsightResponseSchema>;

/** "14 comments, 2 PRs, 1 doc": what the AI read, in the context's own order. */
export function describeAiSource(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([noun, count]) => `${count} ${count === 1 ? singularNoun(noun) : noun}`)
    .join(', ');
}

function singularNoun(noun: string): string {
  if (noun.endsWith('ies')) return `${noun.slice(0, -3)}y`;
  if (noun.endsWith('s') && !noun.endsWith('ss')) return noun.slice(0, -1);
  return noun;
}
