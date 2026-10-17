import { z } from 'zod';

/*
 * Options and mapping, between choosing and starting: what to bring along with the issues or
 * pages, where each chosen project or space goes, and who the people they name are. The plan
 * echoes every choice; a new key that is already taken is an error on that container and
 * blocks the run, never a silent merge into whatever holds the key.
 */

export const IMPORT_INCLUDE_KEYS = [
  'comments',
  'attachments',
  'agile',
  'links',
  'history',
] as const;
export const importIncludeKeySchema = z.enum(IMPORT_INCLUDE_KEYS);
export type ImportIncludeKey = z.infer<typeof importIncludeKeySchema>;

/** What to bring along: every key present, after defaults. */
export const importIncludeSchema = z.object({
  comments: z.boolean(),
  attachments: z.boolean(),
  agile: z.boolean(),
  links: z.boolean(),
  history: z.boolean(),
});

/** One "what to bring" checkbox a source offers, with its default. */
export const importOptionSchema = z.object({
  name: importIncludeKeySchema,
  label: z.string(),
  description: z.string(),
  default: z.boolean(),
});

/** Work's and Docs' key rule: a capital letter, then 1 to 9 capitals or digits. */
export const IMPORT_TARGET_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

/** Where the admin asks a container to go. */
export const importTargetRequestSchema = z.union([
  z
    .object({
      mode: z.literal('create'),
      key: z.string().regex(IMPORT_TARGET_KEY_PATTERN, 'Use 2 to 10 capitals or digits'),
    })
    .strict(),
  z.object({ mode: z.literal('existing'), id: z.uuid() }).strict(),
]);

export const IMPORT_TARGET_MODES = ['create', 'existing', 'update'] as const;

/** Where the plan sends a container: new, into an existing one, or updating an earlier import. */
export const importTargetSchema = z.object({
  mode: z.enum(IMPORT_TARGET_MODES),
  key: z.string(),
  id: z.uuid().nullable(),
  name: z.string().nullable(),
  note: z.string().nullable(),
  /** Why this target cannot be used; the run waits until it is fixed. */
  error: z.string().nullable(),
});

/** When a new key is taken: refuse until it is changed, or take the next free one. */
export const IMPORT_CLASH_RULES = ['error', 'suffix'] as const;

export const IMPORT_PERSON_MATCHES = ['matched', 'placeholder', 'hidden'] as const;

/** A person the chosen containers name, and who they become here. */
export const importPersonRowSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  /** matched: a member with this email; placeholder: no member yet; hidden: no email given. */
  match: z.enum(IMPORT_PERSON_MATCHES),
  userId: z.uuid().nullable(),
  userName: z.string().nullable(),
  /** The admin chose this, rather than the email. */
  override: z.boolean(),
});

export const importPeopleQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const importPeoplePageSchema = z.object({
  items: z.array(importPersonRowSchema),
  next: z.string().nullable(),
});

/** A person goes to this member, or stays a placeholder even if an email matches. */
export const importPersonOverrideSchema = z.union([z.uuid(), z.literal('placeholder')]);

export const importPlanTargetsSchema = z.object({
  create: z.number().int().nonnegative(),
  existing: z.number().int().nonnegative(),
  update: z.number().int().nonnegative(),
  /** Containers whose target has an error; Review waits on these. */
  errors: z.number().int().nonnegative(),
  /** Keys that differ from the source's (made valid, or a suffix after a clash). */
  renamed: z.number().int().nonnegative(),
});

export const importPlanPeopleSchema = z.object({
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  placeholders: z.number().int().nonnegative(),
  hidden: z.number().int().nonnegative(),
});

/** GET /admin/imports/:id/targets: projects or spaces here an import can go into. */
export const importTargetQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const importTargetListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), key: z.string(), name: z.string() })),
});

export type ImportTargetQuery = z.infer<typeof importTargetQuerySchema>;
export type ImportTargetList = z.infer<typeof importTargetListSchema>;
export type ImportInclude = z.infer<typeof importIncludeSchema>;
export type ImportOption = z.infer<typeof importOptionSchema>;
export type ImportTargetRequest = z.infer<typeof importTargetRequestSchema>;
export type ImportTarget = z.infer<typeof importTargetSchema>;
export type ImportClashRule = (typeof IMPORT_CLASH_RULES)[number];
export type ImportPersonRow = z.infer<typeof importPersonRowSchema>;
export type ImportPeopleQuery = z.infer<typeof importPeopleQuerySchema>;
export type ImportPeoplePage = z.infer<typeof importPeoplePageSchema>;
export type ImportPersonOverride = z.infer<typeof importPersonOverrideSchema>;
export type ImportPlanTargets = z.infer<typeof importPlanTargetsSchema>;
export type ImportPlanPeople = z.infer<typeof importPlanPeopleSchema>;
