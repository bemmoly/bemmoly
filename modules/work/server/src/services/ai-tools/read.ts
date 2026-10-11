import { defineReadTool } from '@bemmoly/core';
import { z } from 'zod';
import { issueKeyParamsSchema } from '../../../../shared/common.ts';
import { listIssuesQuerySchema, type IssueDetail } from '../../../../shared/issues.ts';
import { projectRefParamsSchema } from '../../../../shared/boards.ts';
import { listSprintsQuerySchema } from '../../../../shared/sprints.ts';
import type { WorkServices } from '../index.ts';
import { descriptionOf, namesFor, typesWithFields } from './facts.ts';

/*
 * What the palette's planner may look up in Work, as the person asking. Each input is the
 * matching endpoint's own params and query schema; each result is trimmed to the names and
 * ids a plan needs, so the model never guesses an id.
 */

const searchInput = listIssuesQuerySchema
  .pick({ q: true, projectId: true, sprintId: true, sprint: true, statusId: true })
  .extend({ limit: z.number().int().min(1).max(50).default(25) });

/** An issue as the planner reads it: ids beside names, links in plain words. */
export function issueFacts(issue: IssueDetail) {
  return {
    key: issue.key,
    title: issue.title,
    projectId: issue.projectId,
    type: issue.type.name,
    status: { id: issue.status.id, name: issue.status.name, category: issue.status.category },
    priority: issue.priority,
    assignee: issue.assignee ? { id: issue.assignee.id, name: issue.assignee.name } : null,
    sprint: issue.sprint
      ? { id: issue.sprint.id, name: issue.sprint.name, state: issue.sprint.state }
      : null,
    labels: issue.labels.map((label) => ({ id: label.id, name: label.name })),
    links: issue.links.map((link) => ({
      relation: link.inverse ? `${link.kind} (inverse)` : link.kind,
      key: link.issue.key,
      title: link.issue.title,
    })),
  };
}

export function workReadTools(services: WorkServices) {
  return [
    defineReadTool({
      name: 'work_search_issues',
      kind: 'read',
      description:
        'Find issues. q is an LQL query, for example: project = PLT AND status != Done, or ' +
        'text ~ "cookie". Returns key, title, type, parentKey, the ids of status, sprint and ' +
        'assignee, and the description as Markdown (cut at 4000 characters, with ' +
        'descriptionTruncated).',
      input: searchInput,
      execute: async (ctx, input) => {
        const page = await services.issues.list(ctx, {
          ...input,
          sort: 'rank',
          order: 'asc',
          deleted: false,
        });
        const names = await namesFor(services, ctx, page.items);
        return page.items.map((issue) => ({
          key: issue.key,
          title: issue.title,
          type: names.type(issue),
          parentKey: names.parentKey(issue),
          statusId: issue.statusId,
          sprintId: issue.sprintId,
          assigneeId: issue.assigneeId,
          priority: issue.priority,
          ...descriptionOf(issue),
        }));
      },
    }),
    defineReadTool({
      name: 'work_get_issue',
      kind: 'read',
      description:
        'One issue by key, with its status, sprint, assignee, labels and links. A link ' +
        '"blocks (inverse)" to PLT-204 means this issue is blocked by PLT-204.',
      input: issueKeyParamsSchema,
      execute: async (ctx, { key }) => issueFacts(await services.issues.get(ctx, key)),
    }),
    defineReadTool({
      name: 'work_list_transitions',
      kind: 'read',
      description:
        'The statuses an issue can move to now, as its workflow allows. Use the toStatusId ' +
        'with work_change_status.',
      input: issueKeyParamsSchema,
      execute: async (ctx, { key }) =>
        (await services.workflow.issueTransitions(ctx, key)).map((transition) => ({
          toStatusId: transition.toStatusId,
          toStatusName: transition.toStatusName,
          available: transition.available,
          blockedBy: transition.blockedBy,
        })),
    }),
    defineReadTool({
      name: 'work_list_sprints',
      kind: 'read',
      description:
        "A project's sprints by project key, active first, then future (the next sprint is " +
        'the first future one), then closed.',
      input: projectRefParamsSchema.extend(listSprintsQuerySchema.shape),
      execute: async (ctx, { key, ...query }) =>
        (await services.sprints.list(ctx, key, query)).map((sprint) => ({
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
          startsAt: sprint.startsAt,
          endsAt: sprint.endsAt,
        })),
    }),
    defineReadTool({
      name: 'work_list_members',
      kind: 'read',
      description: "A project's members by project key: who an issue can be assigned to.",
      input: projectRefParamsSchema,
      execute: async (ctx, { key }) =>
        (await services.members.list(ctx, key)).items
          .filter((member) => member.status === 'active')
          .map((member) => ({ userId: member.userId, name: member.name })),
    }),
    defineReadTool({
      name: 'work_list_labels',
      kind: 'read',
      description: "A project's labels by project key.",
      input: projectRefParamsSchema,
      execute: async (ctx, { key }) =>
        (await services.labels.list(ctx, key, { limit: 100 })).items.map((label) => ({
          id: label.id,
          name: label.name,
        })),
    }),
    defineReadTool({
      name: 'work_get_project',
      kind: 'read',
      description:
        'A project by key, with its id and issue types, for creating an issue. Each type ' +
        'lists its custom fields (key, name, type, required, options): send them as ' +
        'customFields keyed by field key, every required one included.',
      input: projectRefParamsSchema,
      execute: async (ctx, { key }) => {
        const project = await services.projects.get(ctx, key);
        return {
          id: project.id,
          key: project.key,
          name: project.name,
          issueTypes: await typesWithFields(services, ctx, project.key),
        };
      },
    }),
  ];
}
