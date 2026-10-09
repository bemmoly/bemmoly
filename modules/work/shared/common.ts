import { z } from 'zod';

/** A ProseMirror document; the editor package owns the node schema. */
export const richTextSchema = z.object({ type: z.literal('doc') }).passthrough();

/** "PLT-142": the project key, a dash and the number. */
export const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

export const issueKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ISSUE_KEY_PATTERN, 'Issue keys look like "PLT-142"');

export const issueKeyParamsSchema = z.object({ key: issueKeySchema });

export const nameSchema = z.string().trim().min(1).max(120);

export const shortNameSchema = z.string().trim().min(1).max(60);

/**
 * A yes or no in a query string. `z.coerce.boolean()` reads any non-empty
 * string as true, so `?deleted=false` would have meant deleted; this reads
 * "true" and "false" (and 1, 0, yes, no) as people write them.
 */
export const queryFlagSchema = z.union([z.boolean(), z.stringbool()]);

/** "story", "fix_version": the stable, lowercase key of a type or a field. */
export const slugKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Keys are lowercase letters, digits and underscores');

export type RichText = z.infer<typeof richTextSchema>;
export type IssueKey = z.infer<typeof issueKeySchema>;
