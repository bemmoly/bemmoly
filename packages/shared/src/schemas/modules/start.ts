import { z } from 'zod';

/*
 * The start page, the suite's front door after sign-in: GET /api/v1/start-summaries asks every
 * enabled module the person can open for what it holds for them. A module answers through its
 * `summaryForUser` contract; the page never copies a module's screens, it points into them.
 */

/** One row a module lists: a thing that needs the person, or one they touched lately. */
export const startEntrySchema = z.object({
  /** Stable within the module, e.g. "issue:PLT-204". */
  id: z.string().min(1),
  title: z.string(),
  /** A short handle printed in mono before the title, such as an issue key. */
  handle: z.string().optional(),
  /** Where it lives or why it is listed: "Review requested", "Platform Core". */
  context: z.string().optional(),
  /** A path inside the module that owns it. */
  path: z.string().startsWith('/'),
  /** When it is due, for "needs you"; when it last changed, for recents. */
  at: z.iso.datetime({ offset: true }).nullable().default(null),
});

/** One module's answer: its waiting count, what needs the person, and their recent items. */
export const moduleStartSummarySchema = z.object({
  /** The count and its noun phrase: { count: 4, label: "issues assigned to you" }. */
  waiting: z.object({ count: z.number().int().min(0), label: z.string() }).nullable(),
  needsYou: z.array(startEntrySchema).max(20),
  recent: z.array(startEntrySchema).max(20),
});

export const startSummarySchema = moduleStartSummarySchema.extend({ moduleId: z.string() });

export const startSummariesResponseSchema = z.object({ items: z.array(startSummarySchema) });

export type StartEntry = z.infer<typeof startEntrySchema>;
export type StartEntryInput = z.input<typeof startEntrySchema>;
export type ModuleStartSummary = z.infer<typeof moduleStartSummarySchema>;
export type ModuleStartSummaryInput = z.input<typeof moduleStartSummarySchema>;
export type StartSummary = z.infer<typeof startSummarySchema>;
export type StartSummariesResponse = z.infer<typeof startSummariesResponseSchema>;
