import { defineWriteTool, type RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import { issueKeyParamsSchema } from '../../../../shared/common.ts';
import {
  updateIssueBodySchema,
  type IssueDetail,
  type UpdateIssueBody,
} from '../../../../shared/issues.ts';
import { projectResource } from '../issues/deps.ts';
import type { WorkServices } from '../index.ts';
import { editableIssue, issueHref, projectKeyOf } from './common.ts';
import { issueRefsInput, resolveIssueRefs } from './resolve.ts';

/*
 * Editing several fields of an issue at once, and deleting one. The update goes through the
 * same PATCH path as the Issue page; its undo is the replaced values of the fields it set. A
 * delete is the soft delete, so its undo is the restore.
 */

const updateInput = issueKeyParamsSchema
  .extend(
    updateIssueBodySchema.pick({
      title: true,
      typeId: true,
      priority: true,
      assigneeId: true,
      customFields: true,
    }).shape,
  )
  .extend(issueRefsInput.shape);

type UpdateInput = z.infer<typeof updateInput>;
type Undo = { key: string; body: UpdateIssueBody };

/** The PATCH body the arguments stand for; an empty one changes nothing and is refused. */
async function patchOf(
  services: WorkServices,
  ctx: RequestContext,
  issue: IssueDetail,
  input: UpdateInput,
): Promise<UpdateIssueBody> {
  const { descriptionText, description, type, assigneeEmail, parentKey, ...rest } = input;
  const { title, typeId, priority, assigneeId, customFields } = rest;
  const own: UpdateIssueBody = { title, typeId, priority, assigneeId, customFields };
  const project = { id: issue.projectId, key: projectKeyOf(issue) };
  const refs = await resolveIssueRefs(services, ctx, project, {
    descriptionText,
    description,
    type,
    assigneeEmail,
    parentKey,
  });
  const body: UpdateIssueBody = { ...own, ...refs };
  for (const field of Object.keys(body) as (keyof UpdateIssueBody)[]) {
    if (body[field] === undefined) delete body[field];
  }
  if (Object.keys(body).length === 0) throw new ValidationError('Nothing to change was given');
  return body;
}

/** The values the patch replaces, so undo can write them back. */
function previousOf(issue: IssueDetail, body: UpdateIssueBody): UpdateIssueBody {
  const before: UpdateIssueBody = {};
  if (body.title !== undefined) before.title = issue.title;
  if (body.typeId !== undefined) before.typeId = issue.typeId;
  if (body.priority !== undefined) before.priority = issue.priority;
  if (body.assigneeId !== undefined) before.assigneeId = issue.assigneeId;
  if (body.parentId !== undefined) before.parentId = issue.parentId;
  if (body.description !== undefined) before.description = issue.description;
  if (body.customFields !== undefined) {
    before.customFields = Object.fromEntries(
      Object.keys(body.customFields).map((field) => [field, issue.customFields[field] ?? null]),
    );
  }
  return before;
}

export function updateWriteTools(services: WorkServices) {
  const updateIssue = defineWriteTool<UpdateInput, Undo>({
    name: 'work_update_issue',
    kind: 'write',
    description:
      'Change several fields of an issue by key: title, descriptionText (Markdown), the type ' +
      'by typeId or name, priority, assignee by assigneeId or assigneeEmail (null unassigns), ' +
      'parentKey (null clears), customFields keyed by field key. Status changes go through ' +
      'work_change_status. Returns the key, id and href.',
    input: updateInput,
    idempotent: true,
    describe: async (ctx, input) => {
      const issue = await services.issues.get(ctx, input.key);
      const fields = Object.keys(input).filter((field) => field !== 'key');
      return {
        target: issue.key,
        change: issue.title.slice(0, 2000),
        field: 'Edit',
        from: null,
        to: fields.join(', ').slice(0, 200),
        href: issueHref(issue.key),
      };
    },
    authorize: async (ctx, input) => {
      const issue = await editableIssue(services, ctx, input.key);
      await patchOf(services, ctx, issue, input);
    },
    run: async (ctx, input) => {
      const before = await services.issues.get(ctx, input.key);
      const body = await patchOf(services, ctx, before, input);
      const issue = await services.issues.update(ctx, input.key, body);
      return {
        undo: { key: issue.key, body: previousOf(before, body) },
        result: { key: issue.key, id: issue.id, href: issueHref(issue.key) },
      };
    },
    undo: async (ctx, { key, body }) => {
      await services.issues.update(ctx, key, body);
    },
  });

  const deleteIssue = defineWriteTool<z.infer<typeof issueKeyParamsSchema>, { key: string }>({
    name: 'work_delete_issue',
    kind: 'write',
    description:
      'Delete an issue by key. It can be restored for 30 days (Undo in a plan restores it).',
    input: issueKeyParamsSchema,
    idempotent: false,
    describe: async (ctx, { key }) => {
      const issue = await services.issues.get(ctx, key);
      return {
        target: issue.key,
        change: issue.title.slice(0, 2000),
        field: 'Delete',
        from: null,
        to: null,
        href: issueHref(issue.key),
      };
    },
    authorize: async (ctx, { key }) => {
      const issue = await services.issues.get(ctx, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.delete', projectResource(issue.projectId));
    },
    run: async (ctx, { key }) => {
      const issue = await services.issues.get(ctx, key);
      await services.issues.remove(ctx, key);
      return { undo: { key: issue.key }, result: { key: issue.key, id: issue.id } };
    },
    undo: async (ctx, { key }) => {
      await services.issues.restore(ctx, key);
    },
  });

  return [updateIssue, deleteIssue];
}
