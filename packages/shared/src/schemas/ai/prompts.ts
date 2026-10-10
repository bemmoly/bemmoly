import { z } from 'zod';
import { aiLanguageRoleSchema } from './enums.ts';

/** "issue.summary", "docs.tldr": lowercase, dot-namespaced. */
export const aiPromptIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/)
  .max(128);

/** The frontmatter every prompt file carries. */
export const aiPromptFrontmatterSchema = z.object({
  id: aiPromptIdSchema,
  version: z.number().int().positive(),
  role: aiLanguageRoleSchema,
  description: z.string().min(1).max(500),
  /** Every {{variable}} the template uses must be listed here, and nothing else. */
  variables: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).default([]),
  /** The id of the zod schema the output is validated against, when it is structured. */
  output_schema: z.string().min(1).nullable().default(null),
});
export type AiPromptFrontmatter = z.infer<typeof aiPromptFrontmatterSchema>;

export const aiPromptSchema = z.object({
  id: aiPromptIdSchema,
  version: z.number().int().positive(),
  role: aiLanguageRoleSchema,
  description: z.string(),
  variables: z.array(z.string()),
  outputSchema: z.string().nullable(),
  /** The template in the repository. */
  defaultTemplate: z.string(),
  /** The admin's override, when one is stored; it wins. */
  override: z
    .object({
      template: z.string(),
      updatedAt: z.iso.datetime(),
      updatedBy: z.uuid().nullable(),
    })
    .nullable(),
});
export type AiPrompt = z.infer<typeof aiPromptSchema>;

/** GET /api/v1/admin/ai/prompts */
export const aiPromptListResponseSchema = z.object({ items: z.array(aiPromptSchema) });
export type AiPromptListResponse = z.infer<typeof aiPromptListResponseSchema>;

export const aiPromptParamsSchema = z.object({ id: aiPromptIdSchema });

/**
 * PUT /api/v1/admin/ai/prompts/:id/override stores one; DELETE resets to the default.
 * The template may use only the prompt's declared variables.
 */
export const aiPromptOverrideBodySchema = z.object({
  template: z.string().min(1).max(50_000),
});
export type AiPromptOverrideBody = z.infer<typeof aiPromptOverrideBodySchema>;

export const aiPromptDiffLineSchema = z.object({
  kind: z.enum(['same', 'added', 'removed']),
  text: z.string(),
});
export type AiPromptDiffLine = z.infer<typeof aiPromptDiffLineSchema>;

/** GET /api/v1/admin/ai/prompts/:id/diff: the override against the default, line by line. */
export const aiPromptDiffResponseSchema = z.object({
  id: aiPromptIdSchema,
  lines: z.array(aiPromptDiffLineSchema),
});
export type AiPromptDiffResponse = z.infer<typeof aiPromptDiffResponseSchema>;
