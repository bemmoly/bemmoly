import { createHash } from 'node:crypto';
import type { AiCitation } from '@bemmoly/shared';
import type { AiContentScope, AiPolicy } from '../../../contracts/ai.ts';
import type { AiBuiltContext, AiContextAudience } from './types.ts';

/** One chunk of context: a metadata line always, a body only when policy allows it. */
export interface ContextChunk {
  /** What the citation points at: issue, comment, history, page, section, sprint, pr. */
  kind: string;
  objectId: string;
  label: string;
  location?: string | null;
  href?: string | null;
  /** Titles, keys, statuses and field values: sent even with share content off. */
  line: string;
  /** Descriptions, comments and page text: only with share content on. */
  body?: string | null;
  scope?: AiContentScope;
  /** Counted for "from 14 comments, 2 PRs": the plural noun, e.g. "comments". */
  counts?: string;
}

export interface ContextWriterOptions {
  policy: AiPolicy;
  /** The whole context's budget, in characters (about a quarter of that in tokens). */
  maxChars?: number;
  /** One body's budget; longer text is cut at a word with an ellipsis. */
  maxBodyChars?: number;
  maxCitations?: number;
}

export interface ContextWriter {
  /** Starts an ordered section ("## Comments"). */
  heading(title: string): void;
  /** Adds a cited chunk; returns its id, or null when excluded or over budget. */
  cite(chunk: ContextChunk): string | null;
  /** True when a body from this scope may be sent. */
  allowsBody(scope?: AiContentScope): boolean;
  /** True when nothing from this scope may be sent at all. */
  excluded(scope?: AiContentScope): boolean;
  /** Characters left before the budget is spent. */
  remaining(): number;
  build(audience?: AiContextAudience, variables?: Record<string, string>): AiBuiltContext;
}

export const DEFAULT_CONTEXT_CHARS = 16_000;
export const DEFAULT_BODY_CHARS = 1_500;
const MAX_LINE_CHARS = 300;

/** Whitespace folded, cut at a word boundary with an ellipsis when over `max`. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function excludedUnder(policy: AiPolicy, scope: AiContentScope | undefined): boolean {
  if (!scope) return false;
  if (scope.spaceId && policy.excludedSpaceIds.includes(scope.spaceId)) return true;
  return Boolean(scope.projectId && policy.excludedProjectIds.includes(scope.projectId));
}

export function bodyAllowedUnder(policy: AiPolicy, scope: AiContentScope | undefined): boolean {
  if (!policy.shareContent || excludedUnder(policy, scope)) return false;
  return !(scope?.authorId && policy.optedOutUserIds.includes(scope.authorId));
}

/**
 * Writes a bounded, ordered context. Citation ids are assigned in writing order, so the same
 * inputs always give the same ids and the same hash. Privacy is applied here, once, for every
 * builder: excluded scopes are left out entirely; with share content off, or for an opted-out
 * author, only the metadata line goes.
 */
export function createContextWriter(options: ContextWriterOptions): ContextWriter {
  const { policy } = options;
  const maxChars = options.maxChars ?? DEFAULT_CONTEXT_CHARS;
  const maxBody = options.maxBodyChars ?? DEFAULT_BODY_CHARS;
  const maxCitations = options.maxCitations ?? 120;
  const lines: string[] = [];
  const citations: AiCitation[] = [];
  const counts: Record<string, number> = {};
  let used = 0;
  let withheld = false;

  const push = (text: string): boolean => {
    if (used + text.length + 1 > maxChars) return false;
    lines.push(text);
    used += text.length + 1;
    return true;
  };

  return {
    heading(title) {
      push(`${lines.length > 0 ? '\n' : ''}## ${clip(title, 120)}`);
    },
    cite(chunk) {
      if (excludedUnder(policy, chunk.scope)) return null;
      if (citations.length >= maxCitations) return null;
      const id = `c${citations.length + 1}`;
      let text = `[${id}] ${clip(chunk.line, MAX_LINE_CHARS)}`;
      const body = chunk.body?.trim();
      if (body) {
        if (bodyAllowedUnder(policy, chunk.scope)) {
          const room = Math.min(maxBody, maxChars - used - text.length - 8);
          if (room > 40) text += `\n    ${clip(body, room)}`;
        } else {
          withheld = true;
        }
      }
      if (!push(text)) return null;
      citations.push({
        id,
        kind: chunk.kind,
        objectId: chunk.objectId,
        label: clip(chunk.label, 200),
        location: chunk.location ? clip(chunk.location, 200) : null,
        href: chunk.href ?? null,
      });
      if (chunk.counts) counts[chunk.counts] = (counts[chunk.counts] ?? 0) + 1;
      return id;
    },
    allowsBody: (scope) => bodyAllowedUnder(policy, scope),
    excluded: (scope) => excludedUnder(policy, scope),
    remaining: () => maxChars - used,
    build(audience = {}, variables = {}) {
      const text = lines.join('\n');
      const titlesOnly = withheld || !policy.shareContent;
      const hash = createHash('sha256')
        .update(JSON.stringify([text, citations, titlesOnly, variables]))
        .digest('hex');
      return {
        text,
        citations: [...citations],
        source: { counts: { ...counts }, titlesOnly },
        hash,
        audience,
        variables,
      };
    },
  };
}
