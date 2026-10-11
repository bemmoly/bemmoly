import type { RequestContext } from '@bemmoly/core';
import { fromMarkdownBase, toMarkdown } from '@bemmoly/editor/convert';
import { z } from 'zod';
import { spaceKeySchema, type RichText } from '../../../../shared/common.ts';
import type { DocsServices } from '../index.ts';
import { pagePath } from '../palette/index.ts';

export const pageHref = (id: string) => `/docs/p/${id}`;

/*
 * Long enough for a service's whole runbook in one call; the MCP request body limit (1 MiB)
 * is the real ceiling, and the page tables have none.
 */
export const MARKDOWN_MAX = 200_000;

export const markdownSchema = z.string().max(MARKDOWN_MAX);

/** A space by id or by key, since an agent usually knows the key ("TRP") and not the id. */
export const spaceRefShape = {
  spaceId: z.uuid().optional(),
  spaceKey: spaceKeySchema.optional(),
};

export const hasSpaceRef = (input: { spaceId?: string; spaceKey?: string }) =>
  Boolean(input.spaceId ?? input.spaceKey);

export const SPACE_REF_MESSAGE = 'Give spaceId or spaceKey';

/** The space as the person sees it; throws NotFoundError or ForbiddenError like the screens. */
export function resolveSpace(
  services: DocsServices,
  ctx: RequestContext,
  input: { spaceId?: string; spaceKey?: string },
) {
  return services.spaces.get(ctx, input.spaceId ?? input.spaceKey ?? '');
}

/** An AI's or an agent's Markdown as the editor's document. */
export function markdownDocument(markdown: string): RichText {
  return fromMarkdownBase(markdown) as RichText;
}

/** The page body alone as Markdown, so an agent can compare it with what it means to write. */
export function bodyMarkdown(snapshot: RichText | null): string {
  if (!snapshot) return '';
  return toMarkdown(snapshot as Parameters<typeof toMarkdown>[0], { pageHref: pagePath });
}
