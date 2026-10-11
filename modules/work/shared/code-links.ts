import {
  codeCheckStateSchema,
  codeHostKindSchema,
  codeLinkKindSchema,
  codeLinkStateSchema,
  codeReviewStateSchema,
  timestampSchema,
} from '@bemmoly/shared';
import { z } from 'zod';

/** A pull request, branch or commit linked to an issue, as the Development section shows it. */
export const codeLinkSchema = z.object({
  id: z.uuid(),
  kind: codeLinkKindSchema,
  hostKind: codeHostKindSchema,
  repository: z.string(),
  /** "#4821", "!12", the branch name or a short sha. */
  ref: z.string(),
  title: z.string(),
  url: z.string(),
  state: codeLinkStateSchema.nullable(),
  checks: codeCheckStateSchema.nullable(),
  review: codeReviewStateSchema.nullable(),
  author: z.string().nullable(),
  updatedAt: timestampSchema,
});
export type CodeLink = z.infer<typeof codeLinkSchema>;

export const codeLinksResponseSchema = z.object({ items: z.array(codeLinkSchema) });
export type CodeLinksResponse = z.infer<typeof codeLinksResponseSchema>;

/**
 * A project's optional moves when linked work changes: the status to move an issue to when a
 * pull request opens, and when one merges. Null leaves the issue where it is.
 */
export const codeTransitionsSchema = z.object({
  pullRequestOpened: z.uuid().nullable(),
  pullRequestMerged: z.uuid().nullable(),
});
export type CodeTransitions = z.infer<typeof codeTransitionsSchema>;

export const updateCodeTransitionsBodySchema = codeTransitionsSchema.partial();
export type UpdateCodeTransitionsBody = z.infer<typeof updateCodeTransitionsBodySchema>;

/** The Bemmoly keys a piece of text names: "PLT-204" in "feat/plt-204-sessions". */
const KEY_IN_TEXT = /(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]{1,9})-([1-9][0-9]{0,8})(?![0-9])/g;
/** A commit or a body naming more keys than this is a changelog, not a link. */
export const MAX_KEYS_PER_TEXT = 20;

/**
 * Every issue key named in the texts, upper-cased and deduplicated in reading order. Branch
 * names are often lower case ("feat/plt-204-pg-sessions"), so case is ignored; whether a key
 * is a real issue is for the database to say.
 */
export function findIssueKeys(texts: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    let found = 0;
    for (const match of text.matchAll(KEY_IN_TEXT)) {
      keys.add(`${match[1]!.toUpperCase()}-${match[2]}`);
      found += 1;
      if (found >= MAX_KEYS_PER_TEXT) break;
    }
  }
  return [...keys];
}
