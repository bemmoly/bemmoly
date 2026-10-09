import { z } from 'zod';

/** A ProseMirror document; the editor package owns the node schema. */
export const richTextSchema = z.object({ type: z.literal('doc') }).passthrough();

/** Two to ten capitals or digits, starting with a letter: "ENG", "HR2". */
export const SPACE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export const spaceKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SPACE_KEY_PATTERN, 'Keys are 2 to 10 capital letters or digits');

export const nameSchema = z.string().trim().min(1).max(120);

/** A page title; empty is allowed while a new page is untitled. */
export const pageTitleSchema = z.string().trim().max(500);

/** An emoji or an icon name from the UI kit. */
export const iconSchema = z.string().trim().min(1).max(40);

/**
 * A yes or no in a query string. `z.coerce.boolean()` reads any non-empty
 * string as true, so `?deleted=false` would have meant deleted; this reads
 * "true" and "false" (and 1, 0, yes, no) as people write them.
 */
export const queryFlagSchema = z.union([z.boolean(), z.stringbool()]);

export const PAGE_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const;
export const pageStatusSchema = z.enum(PAGE_STATUSES);

export const pageIdParamsSchema = z.object({ pageId: z.uuid() });
export const spaceKeyParamsSchema = z.object({ spaceKey: spaceKeySchema });

/** A person as the Docs screens show them next to a page: avatar, name. */
export const docsPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export type RichText = z.infer<typeof richTextSchema>;
export type SpaceKey = z.infer<typeof spaceKeySchema>;
export type PageStatus = z.infer<typeof pageStatusSchema>;
export type DocsPerson = z.infer<typeof docsPersonSchema>;
