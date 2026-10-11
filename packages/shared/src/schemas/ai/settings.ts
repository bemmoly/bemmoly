import { z } from 'zod';
import { aiFeedbackSchema, aiRoleSchema } from './enums.ts';

/**
 * Privacy settings in Settings › AI. `enabled` false is "None": every AI endpoint and
 * `ctx.ai` refuse, and the shell hides every AI surface.
 */
export const aiPrivacySchema = z.object({
  enabled: z.boolean(),
  /** Off: builders send titles, keys, statuses and field values, never bodies or comments. */
  shareContent: z.boolean(),
  /** Replace email addresses with stable placeholders before sending; restored in output. */
  redactEmails: z.boolean(),
  /** Replace people's names with stable placeholders before sending; restored in output. */
  redactNames: z.boolean(),
  excludedSpaceIds: z.array(z.uuid()).max(1000),
  excludedProjectIds: z.array(z.uuid()).max(1000),
  /** "Let AI actions change data": off makes the palette a read-only assistant. */
  allowActions: z.boolean(),
  /** People may turn AI off for themselves. */
  perUserOptOutAllowed: z.boolean(),
});
export type AiPrivacy = z.infer<typeof aiPrivacySchema>;

export const aiBudgetSchema = z.object({
  /** USD per calendar month (UTC); null means no limit. */
  monthlyBudgetUsd: z.number().nonnegative().max(1_000_000).nullable(),
});
export type AiBudget = z.infer<typeof aiBudgetSchema>;

/** GET /api/v1/admin/ai/settings */
export const aiSettingsResponseSchema = z.object({
  /** The provider the wizard or Settings › AI chose: a catalog id, "local", or null. */
  providerChoice: z.string().nullable(),
  privacy: aiPrivacySchema,
  budget: aiBudgetSchema,
  /** Fetch models.dev live; off makes the catalog permanently offline (uploads and releases). */
  liveCatalog: z.boolean(),
});
export type AiSettingsResponse = z.infer<typeof aiSettingsResponseSchema>;

/** PATCH /api/v1/admin/ai/settings: any subset. */
export const aiSettingsUpdateBodySchema = z
  .object({
    privacy: aiPrivacySchema.partial(),
    budget: aiBudgetSchema,
    liveCatalog: z.boolean(),
  })
  .partial();
export type AiSettingsUpdateBody = z.infer<typeof aiSettingsUpdateBodySchema>;

export const AI_BUDGET_STATES = ['ok', 'warning', 'paused', 'unlimited'] as const;
export const aiBudgetStateSchema = z.enum(AI_BUDGET_STATES);
export type AiBudgetState = z.infer<typeof aiBudgetStateSchema>;

export const aiBudgetStatusSchema = z.object({
  /** "2026-10": the UTC calendar month. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  spentUsd: z.number().nonnegative(),
  budgetUsd: z.number().nonnegative().nullable(),
  /** spent / budget, null without a budget. */
  ratio: z.number().nonnegative().nullable(),
  /** warning at 80%, paused at 100% (standard and strong stop). */
  state: aiBudgetStateSchema,
  pausedRoles: z.array(aiRoleSchema),
});
export type AiBudgetStatus = z.infer<typeof aiBudgetStatusSchema>;

const usageBucket = z.object({
  key: z.string(),
  runs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type AiUsageBucket = z.infer<typeof usageBucket>;

export const aiUsageQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

/** GET /api/v1/admin/ai/usage */
export const aiUsageResponseSchema = z.object({
  budget: aiBudgetStatusSchema,
  totals: usageBucket.omit({ key: true }),
  byRole: z.array(usageBucket),
  byPurpose: z.array(usageBucket),
  byModel: z.array(usageBucket),
  failures: z.number().int().nonnegative(),
  feedback: z.record(aiFeedbackSchema, z.number().int().nonnegative()),
});
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;

/** PUT /api/v1/ai/runs/:id/feedback: "Not useful" on any AI card. */
export const aiRunFeedbackBodySchema = z.object({ feedback: aiFeedbackSchema.nullable() });
export type AiRunFeedbackBody = z.infer<typeof aiRunFeedbackBodySchema>;

/** GET /api/v1/ai/status: what a signed-in person's client needs to draw AI surfaces. */
export const aiStatusResponseSchema = z.object({
  enabled: z.boolean(),
  /** This person turned AI off for themselves (only when the admin allows it). */
  optedOut: z.boolean(),
  optOutAllowed: z.boolean(),
  /** This person's ghost text switch in the editor; on unless they turned it off. */
  ghostText: z.boolean().default(true),
  /**
   * The spaces and projects Settings › AI › Privacy excludes, so a client hides the AI
   * actions there (such as "Suggest a fix") instead of offering one the server refuses.
   */
  excludedSpaceIds: z.array(z.uuid()).default([]),
  excludedProjectIds: z.array(z.uuid()).default([]),
  allowActions: z.boolean(),
  /** Roles that can be called now: assigned, and not paused by the budget. */
  availableRoles: z.array(aiRoleSchema),
  budgetState: aiBudgetStateSchema,
});
export type AiStatusResponse = z.infer<typeof aiStatusResponseSchema>;

/** GET /api/v1/admin/ai/exclusion-targets: the spaces and projects Privacy can exclude. */
export const aiExclusionTargetSchema = z.object({
  kind: z.enum(['space', 'project']),
  id: z.uuid(),
  name: z.string(),
  key: z.string().nullable(),
  moduleId: z.string(),
});
export type AiExclusionTarget = z.infer<typeof aiExclusionTargetSchema>;

export const aiExclusionTargetsResponseSchema = z.object({
  items: z.array(aiExclusionTargetSchema),
});
export type AiExclusionTargetsResponse = z.infer<typeof aiExclusionTargetsResponseSchema>;

/**
 * PUT /api/v1/ai/preferences: a person's own AI preferences. Send only what changes, and at
 * least one of them.
 */
export const aiPreferencesBodySchema = z
  .object({
    optedOut: z.boolean().optional(),
    /** Ghost text in the editor, on every device the person signs in from. */
    ghostText: z.boolean().optional(),
  })
  .refine((body) => body.optedOut !== undefined || body.ghostText !== undefined, {
    message: 'Send optedOut, ghostText or both',
  });
export type AiPreferencesBody = z.infer<typeof aiPreferencesBodySchema>;
