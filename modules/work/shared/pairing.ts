import { z } from 'zod';

/*
 * The pairing matrix: who held issues at the same time as whom in one project. A pair is two
 * people whose assignee stints on one issue overlap inside the range; three on an issue at once
 * are three pairs. Rows are derived from issue_assignees on read, nothing is stored.
 */

/** The window, as calendar days; it defaults to the last 90 days. */
export const pairingQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'The range starts after it ends',
    path: ['from'],
  });

export const pairingPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Issues they held in the range, alone or not. */
  issues: z.number().int().nonnegative(),
});

export const pairingIssueSchema = z.object({ key: z.string(), title: z.string() });

/** One unordered pair, a before b by id, so each pair appears once. */
export const pairingCellSchema = z.object({
  a: z.uuid(),
  b: z.uuid(),
  /** Issues they shared. */
  count: z.number().int().positive(),
  /** Time they were on those issues together, in hours. */
  hours: z.number().nonnegative(),
  lastPairedAt: z.iso.datetime(),
  /** The most recent shared issues, at most ten. */
  issues: z.array(pairingIssueSchema).max(10),
});

/** Two people to pair next: the pairs that worked together least, and longest ago. */
export const pairingSuggestionSchema = z.object({
  a: z.uuid(),
  b: z.uuid(),
  /** Issues they shared in the range; 0 for never. */
  count: z.number().int().nonnegative(),
  lastPairedAt: z.iso.datetime().nullable(),
});

export const pairingMatrixSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  /** Everyone who held an issue in the range, most issues first. */
  people: z.array(pairingPersonSchema),
  cells: z.array(pairingCellSchema),
  /** Present only while the workspace has suggestions on; each person in at most one pair. */
  suggestions: z.array(pairingSuggestionSchema).optional(),
});

export type PairingQuery = z.infer<typeof pairingQuerySchema>;
export type PairingPerson = z.infer<typeof pairingPersonSchema>;
export type PairingCell = z.infer<typeof pairingCellSchema>;
export type PairingSuggestion = z.infer<typeof pairingSuggestionSchema>;
export type PairingMatrix = z.infer<typeof pairingMatrixSchema>;
