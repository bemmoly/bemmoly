import { defineWriteTool, requestToolInput } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeyParamsSchema } from '../../../../shared/common.ts';
import { assignIssueBodySchema, updateIssueBodySchema } from '../../../../shared/issues.ts';
import { labelSchema } from '../../../../shared/links-labels.ts';
import { projectResource } from '../issues/deps.ts';
import type { WorkServices } from '../index.ts';
import { editableIssue, fieldPreview, priorityName, projectKeyOf } from './common.ts';

/*
 * Field changes on one issue, each through the same issues service the Issue page calls. Each
 * input is the issue's key params plus the PATCH body's own field, and each run hands back the
 * value it replaced so Undo can put it back.
 */

const body = updateIssueBodySchema;
const sprintInput = requestToolInput(
  issueKeyParamsSchema,
  body.pick({ sprintId: true }).required(),
);
const statusInput = requestToolInput(
  issueKeyParamsSchema,
  body.pick({ statusId: true }).required(),
);
const priorityInput = requestToolInput(
  issueKeyParamsSchema,
  body.pick({ priority: true }).required(),
);
const assignInput = requestToolInput(issueKeyParamsSchema, assignIssueBodySchema);
const labelInput = requestToolInput(
  issueKeyParamsSchema,
  z.object({ labelId: labelSchema.shape.id }),
);

type Key = { key: string };

export function issueWriteTools(services: WorkServices) {
  const sprintName = async (
    ctx: Parameters<WorkServices['sprints']['get']>[0],
    id: string | null,
  ) => (id ? (await services.sprints.get(ctx, id)).name : 'Backlog');

  const moveToSprint = defineWriteTool<
    z.infer<typeof sprintInput>,
    Key & { sprintId: string | null }
  >({
    name: 'work_move_to_sprint',
    kind: 'write',
    description:
      'Move an issue to a sprint (sprintId from work_list_sprints), or to the backlog with null.',
    input: sprintInput,
    idempotent: true,
    describe: async (ctx, { key, sprintId }) => {
      const issue = await services.issues.get(ctx, key);
      return fieldPreview(issue, issue.sprint?.name ?? 'Backlog', await sprintName(ctx, sprintId));
    },
    authorize: async (ctx, { key, sprintId }) => {
      const issue = await editableIssue(services, ctx, key);
      if (sprintId && (await services.sprints.get(ctx, sprintId)).projectId !== issue.projectId) {
        throw new ValidationError(`That sprint is not in ${key}'s project`);
      }
    },
    run: async (ctx, { key, sprintId }) => {
      const before = await services.issues.get(ctx, key);
      await services.issues.update(ctx, key, { sprintId });
      return { undo: { key, sprintId: before.sprintId } };
    },
    undo: async (ctx, { key, sprintId }) => {
      await services.issues.update(ctx, key, { sprintId });
    },
  });

  const changeStatus = defineWriteTool<z.infer<typeof statusInput>, Key & { statusId: string }>({
    name: 'work_change_status',
    kind: 'write',
    description: 'Move an issue to another status (toStatusId from work_list_transitions).',
    input: statusInput,
    idempotent: true,
    describe: async (ctx, { key, statusId }) => {
      const issue = await services.issues.get(ctx, key);
      const transitions = await services.workflow.issueTransitions(ctx, key);
      const to = transitions.find((transition) => transition.toStatusId === statusId);
      return fieldPreview(issue, issue.status.name, to?.toStatusName ?? 'Another status');
    },
    authorize: async (ctx, { key, statusId }) => {
      const issue = await editableIssue(services, ctx, key);
      await ctx.authz.authorize(
        ctx.actor,
        'work.issue.transition',
        projectResource(issue.projectId),
      );
      if (issue.statusId === statusId) return;
      const transitions = await services.workflow.issueTransitions(ctx, key);
      const to = transitions.find((transition) => transition.toStatusId === statusId);
      if (!to) throw new ValidationError(`The workflow has no way to move ${key} there`);
      if (!to.available) {
        throw new ValidationError(to.blockedBy[0] ?? `${key} can't move to ${to.toStatusName} yet`);
      }
    },
    run: async (ctx, { key, statusId }) => {
      const before = await services.issues.get(ctx, key);
      await services.issues.update(ctx, key, { statusId });
      return { undo: { key, statusId: before.statusId } };
    },
    undo: async (ctx, { key, statusId }) => {
      await services.issues.update(ctx, key, { statusId });
    },
  });

  const assign = defineWriteTool<z.infer<typeof assignInput>, Key & { assigneeId: string | null }>({
    name: 'work_assign_issue',
    kind: 'write',
    description: 'Assign an issue to a project member (userId from work_list_members), or null.',
    input: assignInput,
    idempotent: true,
    describe: async (ctx, { key, assigneeId }) => {
      const issue = await services.issues.get(ctx, key);
      const members = assigneeId
        ? (await services.members.list(ctx, projectKeyOf(issue))).items
        : [];
      const to = members.find((member) => member.userId === assigneeId)?.name ?? 'Someone';
      return fieldPreview(
        issue,
        issue.assignee?.name ?? 'Unassigned',
        assigneeId ? to : 'Unassigned',
      );
    },
    authorize: async (ctx, { key }) => {
      await editableIssue(services, ctx, key);
    },
    run: async (ctx, { key, assigneeId }) => {
      const before = await services.issues.get(ctx, key);
      await services.issues.assign(ctx, key, assigneeId);
      return { undo: { key, assigneeId: before.assigneeId } };
    },
    undo: async (ctx, { key, assigneeId }) => {
      await services.issues.assign(ctx, key, assigneeId);
    },
  });

  const setPriority = defineWriteTool<z.infer<typeof priorityInput>, Key & { priority: string }>({
    name: 'work_set_priority',
    kind: 'write',
    description: "Change an issue's priority.",
    input: priorityInput,
    idempotent: true,
    describe: async (ctx, { key, priority }) => {
      const issue = await services.issues.get(ctx, key);
      return fieldPreview(issue, priorityName(issue.priority), priorityName(priority));
    },
    authorize: async (ctx, { key }) => {
      await editableIssue(services, ctx, key);
    },
    run: async (ctx, { key, priority }) => {
      const before = await services.issues.get(ctx, key);
      await services.issues.update(ctx, key, { priority });
      return { undo: { key, priority: before.priority } };
    },
    undo: async (ctx, { key, priority }) => {
      await services.issues.update(ctx, key, {
        priority: priorityInput.shape.priority.parse(priority),
      });
    },
  });

  const addLabel = defineWriteTool<z.infer<typeof labelInput>, Key & { labelIds: string[] }>({
    name: 'work_add_label',
    kind: 'write',
    description: 'Add a label to an issue (labelId from work_list_labels).',
    input: labelInput,
    idempotent: true,
    describe: async (ctx, { key, labelId }) => {
      const issue = await services.issues.get(ctx, key);
      const labels = (await services.labels.list(ctx, projectKeyOf(issue), { limit: 100 })).items;
      const name = labels.find((label) => label.id === labelId)?.name ?? 'a label';
      return { ...fieldPreview(issue, '', name), field: 'Label', from: null };
    },
    authorize: async (ctx, { key }) => {
      await editableIssue(services, ctx, key);
    },
    run: async (ctx, { key, labelId }) => {
      const before = await services.issues.get(ctx, key);
      const labelIds = before.labelIds.includes(labelId)
        ? before.labelIds
        : [...before.labelIds, labelId];
      await services.issues.update(ctx, key, { labelIds });
      return { undo: { key, labelIds: before.labelIds } };
    },
    undo: async (ctx, { key, labelIds }) => {
      await services.issues.update(ctx, key, { labelIds });
    },
  });

  return [moveToSprint, changeStatus, assign, setPriority, addLabel];
}
