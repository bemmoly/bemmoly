import { defineWriteTool, requestToolInput } from '@bemmoly/core';
import { z } from 'zod';
import { createCommentBodySchema } from '../../../../shared/comments.ts';
import { issueKeyParamsSchema } from '../../../../shared/common.ts';
import { createIssueBodySchema } from '../../../../shared/issues.ts';
import { projectResource } from '../issues/deps.ts';
import type { WorkServices } from '../index.ts';
import { issueHref, textDocument } from './common.ts';

/*
 * Writes that add a record: a comment and an issue. The model writes plain words; the tool
 * makes the editor document, so the comment and description schemas stay the API's own apart
 * from the body, which is text here and rich text on the wire.
 */

const commentInput = requestToolInput(
  issueKeyParamsSchema,
  createCommentBodySchema.omit({ body: true, parentId: true }),
).extend({ text: z.string().trim().min(1).max(2000) });

const issueInput = createIssueBodySchema
  .omit({ description: true, customFields: true, parentId: true })
  .extend({ descriptionText: z.string().trim().max(4000).optional() });

export function createWriteTools(services: WorkServices) {
  const addComment = defineWriteTool<z.infer<typeof commentInput>, { commentId: string }>({
    name: 'work_add_comment',
    kind: 'write',
    description:
      'Post a short comment on an issue, in plain words. Bemmoly signs it "via Bemmoly for" ' +
      'the person.',
    input: commentInput,
    // A comment posted twice is two comments; an interrupted step is checked, not repeated.
    idempotent: false,
    describe: async (ctx, { key, text }) => {
      const issue = await services.issues.get(ctx, key);
      return {
        target: issue.key,
        change: text,
        field: 'Comment',
        from: null,
        to: null,
        href: issueHref(issue.key),
      };
    },
    authorize: async (ctx, { key }) => {
      const issue = await services.issues.get(ctx, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(issue.projectId));
    },
    run: async (ctx, { key, text }) => {
      const comment = await services.comments.create(
        ctx,
        key,
        { body: textDocument(`${text} — ${ctx.attribution}`) },
        { aiRunId: ctx.runId },
      );
      return { undo: { commentId: comment.id } };
    },
    undo: async (ctx, { commentId }) => {
      await services.comments.remove(ctx, commentId);
    },
  });

  const createIssue = defineWriteTool<z.infer<typeof issueInput>, { key: string }>({
    name: 'work_create_issue',
    kind: 'write',
    description:
      'Create an issue in a project (projectId and typeId from work_get_project). Optional ' +
      'fields take ids read from the other tools.',
    input: issueInput,
    idempotent: false,
    describe: async (ctx, input) => {
      const projects = await services.projects.list(ctx, { limit: 100, archived: false });
      const project = projects.items.find((item) => item.id === input.projectId);
      return {
        target: project?.key ?? 'New',
        change: input.title,
        field: 'New issue',
        from: null,
        to: null,
        href: null,
      };
    },
    authorize: async (ctx, input) => {
      await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(input.projectId));
    },
    run: async (ctx, { descriptionText, ...input }) => {
      const issue = await services.issues.create(ctx, {
        ...input,
        ...(descriptionText ? { description: textDocument(descriptionText) } : {}),
      });
      return { undo: { key: issue.key } };
    },
    undo: async (ctx, { key }) => {
      await services.issues.remove(ctx, key);
    },
  });

  return [addComment, createIssue];
}
