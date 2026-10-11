import { defineWriteTool } from '@bemmoly/core';
import { z } from 'zod';
import { issueKeySchema } from '../../../../shared/common.ts';
import { createIssueLinkBodySchema } from '../../../../shared/links-labels.ts';
import type { WorkServices } from '../index.ts';
import { editableIssue, issueHref } from './common.ts';

/*
 * A link between two issues, through the links service the Linked issues section uses. The
 * kind reads from the first issue: PLT-1 blocks PLT-2.
 */

const linkInput = z
  .object({ fromKey: issueKeySchema, toKey: issueKeySchema })
  .extend(createIssueLinkBodySchema.pick({ kind: true }).shape);

export function linkWriteTools(services: WorkServices) {
  const linkIssues = defineWriteTool<z.infer<typeof linkInput>, { linkId: string }>({
    name: 'work_link_issues',
    kind: 'write',
    description:
      'Link two issues by key: kind blocks (fromKey blocks toKey), relates or duplicates ' +
      '(fromKey duplicates toKey). Returns the link id.',
    input: linkInput,
    idempotent: false,
    describe: async (ctx, { fromKey, toKey, kind }) => {
      const issue = await services.issues.get(ctx, fromKey);
      return {
        target: issue.key,
        change: issue.title.slice(0, 2000),
        field: 'Link',
        from: null,
        to: `${kind} ${toKey}`,
        href: issueHref(issue.key),
      };
    },
    authorize: async (ctx, { fromKey, toKey }) => {
      await editableIssue(services, ctx, fromKey);
      await services.issues.get(ctx, toKey);
    },
    run: async (ctx, { fromKey, toKey, kind }) => {
      const target = await services.issues.get(ctx, toKey);
      const link = await services.links.create(ctx, fromKey, { targetId: target.id, kind });
      return { undo: { linkId: link.id }, result: { linkId: link.id, fromKey, toKey, kind } };
    },
    undo: async (ctx, { linkId }) => {
      await services.links.remove(ctx, linkId);
    },
  });

  return [linkIssues];
}
