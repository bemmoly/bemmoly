import { z } from 'zod';
import { aiRoleSchema } from './enums.ts';

/**
 * What a model can do, copied from the catalog when a role is assigned, so a catalog refresh
 * cannot silently change behaviour. Costs are USD per million tokens.
 */
export const aiModelCapabilitiesSchema = z.object({
  toolCall: z.boolean(),
  structuredOutput: z.boolean(),
  reasoning: z.boolean(),
  attachment: z.boolean(),
  temperature: z.boolean(),
  contextWindow: z.number().int().nonnegative().nullable(),
  maxOutput: z.number().int().nonnegative().nullable(),
  inputModalities: z.array(z.string()),
  outputModalities: z.array(z.string()),
  cost: z
    .object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cacheRead: z.number().nonnegative().nullable(),
      cacheWrite: z.number().nonnegative().nullable(),
    })
    .nullable(),
  /** Vector size, for the embedding role. */
  dimensions: z.number().int().positive().nullable(),
  status: z.string().nullable(),
  releaseDate: z.string().nullable(),
});
export type AiModelCapabilities = z.infer<typeof aiModelCapabilitiesSchema>;

export const AI_REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
export const aiReasoningEffortSchema = z.enum(AI_REASONING_EFFORTS);
export type AiReasoningEffort = z.infer<typeof aiReasoningEffortSchema>;

export const aiModelRoleSchema = z.object({
  role: aiRoleSchema,
  providerId: z.uuid(),
  providerName: z.string(),
  model: z.string(),
  reasoningEffort: aiReasoningEffortSchema.nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
  temperature: z.number().min(0).max(2).nullable(),
  capabilities: aiModelCapabilitiesSchema,
  /** Set when the catalog marks the model deprecated; names the suggested successor. */
  deprecation: z.object({ successor: z.string().nullable() }).nullable(),
  /** True while the monthly budget is spent and this role is paused. */
  paused: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type AiModelRole = z.infer<typeof aiModelRoleSchema>;

/** GET /api/v1/admin/ai/roles: every role, null where none is assigned. */
export const aiModelRolesResponseSchema = z.object({
  items: z.array(z.object({ role: aiRoleSchema, assignment: aiModelRoleSchema.nullable() })),
});
export type AiModelRolesResponse = z.infer<typeof aiModelRolesResponseSchema>;

/** PUT /api/v1/admin/ai/roles/:role. DELETE clears it. */
export const aiModelRoleBodySchema = z.object({
  providerId: z.uuid(),
  model: z.string().min(1).max(256),
  reasoningEffort: aiReasoningEffortSchema.nullable().default(null),
  maxOutputTokens: z.number().int().positive().max(1_000_000).nullable().default(null),
  temperature: z.number().min(0).max(2).nullable().default(null),
});
export type AiModelRoleBody = z.infer<typeof aiModelRoleBodySchema>;

export const aiRoleParamsSchema = z.object({ role: aiRoleSchema });
