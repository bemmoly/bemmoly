import { z } from 'zod';

/** Model roles an admin maps to a provider and model in Settings › AI. */
export const AI_ROLES = ['fast', 'standard', 'strong', 'embedding'] as const;
export const aiRoleSchema = z.enum(AI_ROLES);
export type AiRole = z.infer<typeof aiRoleSchema>;

/** The roles that produce text; `embedding` only turns text into vectors. */
export const AI_LANGUAGE_ROLES = ['fast', 'standard', 'strong'] as const;
export const aiLanguageRoleSchema = z.enum(AI_LANGUAGE_ROLES);
export type AiLanguageRole = z.infer<typeof aiLanguageRoleSchema>;

/** Roles that pause when the monthly budget is spent; `fast` and `embedding` keep running. */
export const AI_BUDGET_PAUSED_ROLES = ['standard', 'strong'] as const satisfies readonly AiRole[];

/**
 * Why a model is called, recorded on every ai_runs row. The known purposes are listed for
 * reports; a feature may add its own as long as it is lowercase snake_case, optionally
 * namespaced with a dot ("docs.tldr").
 */
export const AI_KNOWN_PURPOSES = [
  'summary',
  'brief',
  'qa',
  'plan',
  'autocomplete',
  'consistency',
  'fill_field',
  'embed',
  'tldr',
  'pulse',
  'forecast',
  'draft',
  'connection_test',
] as const;
export const aiPurposeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'Use lowercase snake_case, dot-namespaced')
  .max(64);
export type AiPurpose = (typeof AI_KNOWN_PURPOSES)[number] | (string & {});

/** How a custom ("Local server") endpoint speaks: the two wire protocols the runtime knows. */
export const AI_CUSTOM_PROTOCOLS = ['openai-compatible', 'anthropic-compatible'] as const;
export const aiCustomProtocolSchema = z.enum(AI_CUSTOM_PROTOCOLS);
export type AiCustomProtocol = z.infer<typeof aiCustomProtocolSchema>;

/** Where the catalog the picker shows came from. */
export const AI_CATALOG_SOURCES = ['live', 'uploaded', 'bundled'] as const;
export const aiCatalogSourceSchema = z.enum(AI_CATALOG_SOURCES);
export type AiCatalogSource = z.infer<typeof aiCatalogSourceSchema>;

/** How every model call ended, on its ai_runs row. */
export const AI_RUN_OUTCOMES = [
  'ok',
  'repaired',
  'error',
  'invalid_output',
  'timeout',
  'cancelled',
  'refused',
] as const;
export const aiRunOutcomeSchema = z.enum(AI_RUN_OUTCOMES);
export type AiRunOutcome = z.infer<typeof aiRunOutcomeSchema>;

export const AI_FEEDBACK = ['useful', 'not_useful'] as const;
export const aiFeedbackSchema = z.enum(AI_FEEDBACK);
export type AiFeedback = z.infer<typeof aiFeedbackSchema>;

/**
 * Why the runtime refused a call before reaching a provider. Sent as `details.reason` on a
 * ForbiddenError so the UI can say it in plain words ("AI is turned off", "This month's AI
 * budget is spent").
 */
export const AI_REFUSAL_REASONS = [
  'ai_off',
  'role_unset',
  'budget_reached',
  'opted_out',
  'excluded',
  'actions_off',
] as const;
export const aiRefusalReasonSchema = z.enum(AI_REFUSAL_REASONS);
export type AiRefusalReason = z.infer<typeof aiRefusalReasonSchema>;

export const aiRefusalDetailsSchema = z.object({
  reason: aiRefusalReasonSchema,
  role: aiRoleSchema.optional(),
});
export type AiRefusalDetails = z.infer<typeof aiRefusalDetailsSchema>;

/**
 * What kind of provider failure a ProviderError from the AI runtime carries in `details`,
 * so copy can be honest: "<provider> returned a rate limit; I'll retry in 30 seconds".
 */
export const AI_PROVIDER_FAILURES = [
  'rate_limit',
  'auth',
  'timeout',
  'unavailable',
  'bad_request',
  'invalid_output',
  'not_found',
  'unknown',
] as const;
export const aiProviderFailureSchema = z.enum(AI_PROVIDER_FAILURES);
export type AiProviderFailure = z.infer<typeof aiProviderFailureSchema>;

export const aiProviderErrorDetailsSchema = z.object({
  failure: aiProviderFailureSchema,
  /** The provider's display name, from the catalog or the custom endpoint. */
  provider: z.string(),
  /** The provider's own message, trimmed; never a credential. */
  providerMessage: z.string().nullable(),
  retryAfterSeconds: z.number().int().nonnegative().nullable(),
});
export type AiProviderErrorDetails = z.infer<typeof aiProviderErrorDetailsSchema>;
