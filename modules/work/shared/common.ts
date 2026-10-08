import { z } from 'zod';

/** A ProseMirror document; the editor package owns the node schema. */
export const richTextSchema = z.object({ type: z.literal('doc') }).passthrough();

/** "PLT-142": the project key, a dash and the number. */
export const issueKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/, 'Issue keys look like "PLT-142"');

export const issueKeyParamsSchema = z.object({ key: issueKeySchema });

export const nameSchema = z.string().trim().min(1).max(120);

export const shortNameSchema = z.string().trim().min(1).max(60);

/** "story", "fix_version": the stable, lowercase key of a type or a field. */
export const slugKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Keys are lowercase letters, digits and underscores');

export type RichText = z.infer<typeof richTextSchema>;
export type IssueKey = z.infer<typeof issueKeySchema>;
