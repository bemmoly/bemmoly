import { defineWriteTool, requestToolInput } from '@bemmoly/core';
import { z } from 'zod';
import { createCommentBodySchema } from '../../../../shared/comments.ts';
import { issueKeyParamsSchema } from '../../../../shared/common.ts';
import { ValidationError } from '@bemmoly/shared';
import type { RequestContext } from '@bemmoly/core';
import { createIssueBodySchema, type CreateIssueBody } from '../../../../shared/issues.ts';
import { projectResource } from '../issues/deps.ts';
import type { WorkServices } from '../index.ts';
import { issueHref, textDocument } from './common.ts';
import { issueRefsInput, markdownSchema, projectById, resolveIssueRefs } from './resolve.ts';

/*
 * Writes that add a record: a comment and an issue. The model writes Markdown; the tool
 * makes the editor document, so the comment and description schemas stay the API's own apart
 * from the body, which is text here and rich text on the wire. References a client knows by
 * name (a status, a type, an assignee's email, a parent's key) resolve to the ids the API takes.
 */

const commentInput = requestToolInput(
  issueKeyParamsSchema,
  createCommentBodySchema.omit({ body: true, parentId: true }),
).extend({ text: markdownSchema.min(1).describe('The comment, in Markdown.') });

const issueInput = createIssueBodySchema
  .omit({ description: true, parentId: true, statusId: true, typeId: true })
  .extend(issueRefsInput.shape)
  .extend({
    typeId: createIssueBodySchema.shape.typeId.optional(),
    status: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe("Starting status by name or id: any status of the project's workflow."),
  });

/** One line keeps its signature; longer Markdown gets it as its own paragraph, out of any block. */
const signed = (text: string, attribution: string) =>
  text.includes('\n') ? `${text}\n\n— ${attribution}` : `${text} — ${attribution}`;

type IssueInput = z.infer<typeof issueInput>;

/** The API's create body for the tool's arguments, every name resolved as the person. */
async function createBody(
  services: WorkServices,
  ctx: RequestContext,
  input: IssueInput,
): Promise<CreateIssueBody> {
  const { descriptionText, description, type, status, assigneeEmail, parentKey, ...rest } = input;
  if (!rest.typeId && !type) throw new ValidationError('Give the issue type: typeId or type');
  const project = await projectById(services, ctx, rest.projectId);
  const refs = await resolveIssueRefs(services, ctx, project, {
    descriptionText,
    description,
    type,
    status,
    assigneeEmail,
    parentKey,
  });
  const typeId = refs.typeId ?? rest.typeId;
  if (!typeId) throw new ValidationError('Give the issue type: typeId or type');
  return {
    ...rest,
    typeId,
    ...(refs.description ? { description: refs.description } : {}),
    ...(refs.statusId ? { statusId: refs.statusId } : {}),
    ...(refs.assigneeId ? { assigneeId: refs.assigneeId } : {}),
    ...(refs.parentId ? { parentId: refs.parentId } : {}),
  };
}

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
        change: text.slice(0, 2000),
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
        { body: textDocument(signed(text, ctx.attribution)) },
        { aiRunId: ctx.runId },
      );
      return {
        undo: { commentId: comment.id },
        result: { commentId: comment.id, key, href: issueHref(key) },
      };
    },
    undo: async (ctx, { commentId }) => {
      await services.comments.remove(ctx, commentId);
    },
  });

  const createIssue = defineWriteTool<IssueInput, { key: string }>({
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
      await createBody(services, ctx, input);
    },
    run: async (ctx, input) => {
      const issue = await services.issues.create(ctx, await createBody(services, ctx, input));
      return {
        undo: { key: issue.key },
        result: { key: issue.key, id: issue.id, href: issueHref(issue.key) },
      };
    },
    undo: async (ctx, { key }) => {
      await services.issues.remove(ctx, key);
    },
  });

  return [addComment, createIssue];
}
