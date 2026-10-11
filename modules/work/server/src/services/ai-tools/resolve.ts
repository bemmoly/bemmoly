import type { RequestContext } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema } from '../../../../shared/common.ts';
import type { UpdateIssueBody } from '../../../../shared/issues.ts';
import type { WorkServices } from '../index.ts';
import { textDocument } from './common.ts';

/*
 * The names a client knows turned into the ids the issues service takes: a status or a type by
 * name, an assignee by email, a parent by key. Each is read as the person asking, so a name
 * they cannot see resolves to nothing, and a miss says what would have matched.
 */

/** Long enough for a migrated description; the column is text, the editor holds far more. */
export const MARKDOWN_MAX = 100_000;

export const markdownSchema = z.string().trim().max(MARKDOWN_MAX);

/** What a create and an update both take by name, beside the API's own fields. */
export const issueRefsInput = z.object({
  descriptionText: markdownSchema
    .optional()
    .describe('The description, in Markdown (headings, lists, code, links).'),
  description: markdownSchema.optional().describe('Same as descriptionText.'),
  type: z.string().trim().min(1).max(120).optional().describe('Issue type by name, or typeId.'),
  assigneeEmail: z.email().optional().describe('Assignee by email; must be a project member.'),
  parentKey: issueKeySchema.nullable().optional().describe('Parent issue (epic) by key.'),
});

export type IssueRefs = z.infer<typeof issueRefsInput> & { status?: string | undefined };

export interface ProjectRef {
  id: string;
  key: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A project by id, as the person sees it; the create tools take the id get_project gave. */
export async function projectById(
  services: WorkServices,
  ctx: RequestContext,
  id: string,
): Promise<ProjectRef> {
  let cursor: string | undefined;
  do {
    const page = await services.projects.list(ctx, {
      limit: 200,
      archived: false,
      ...(cursor ? { cursor } : {}),
    });
    const found = page.items.find((project) => project.id === id);
    if (found) return { id: found.id, key: found.key };
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  throw new NotFoundError('The project was not found');
}

/** The workflow a project's issues follow: its own, else the org default it inherits. */
export async function projectStatuses(
  services: WorkServices,
  ctx: RequestContext,
  projectId: string,
) {
  const workflows = await services.workflow.list(ctx, projectId);
  const workflow =
    workflows.find((candidate) => candidate.projectId === projectId) ??
    workflows.find((candidate) => candidate.projectId === null);
  if (!workflow) throw new ValidationError('The project has no workflow');
  return [...workflow.statuses].sort((a, b) => a.position - b.position);
}

export async function resolveStatusId(
  services: WorkServices,
  ctx: RequestContext,
  project: ProjectRef,
  nameOrId: string,
): Promise<string> {
  const statuses = await projectStatuses(services, ctx, project.id);
  const match = statuses.find((status) => status.id === nameOrId || same(status.name, nameOrId));
  if (match) return match.id;
  const names = statuses.map((status) => status.name).join(', ');
  throw new ValidationError(`No status "${nameOrId}" in ${project.key}'s workflow: ${names}`);
}

async function resolveTypeId(
  services: WorkServices,
  ctx: RequestContext,
  project: ProjectRef,
  nameOrId: string,
): Promise<string> {
  const types = (await services.types.list(ctx, project.key)).items;
  const match = types.find((type) => type.id === nameOrId || same(type.name, nameOrId));
  if (match) return match.id;
  const names = types.map((type) => type.name).join(', ');
  throw new ValidationError(`No issue type "${nameOrId}" in ${project.key}: ${names}`);
}

async function resolveAssigneeId(
  services: WorkServices,
  ctx: RequestContext,
  project: ProjectRef,
  email: string,
): Promise<string> {
  const members = (await services.members.list(ctx, project.key)).items;
  const match = members.find((member) => member.status === 'active' && same(member.email, email));
  if (!match) throw new ValidationError(`${email} is not an active member of ${project.key}`);
  return match.userId;
}

async function resolveParentId(
  services: WorkServices,
  ctx: RequestContext,
  project: ProjectRef,
  key: string,
): Promise<string> {
  const parent = await services.issues.get(ctx, key);
  if (parent.projectId !== project.id) {
    throw new ValidationError(`${key} is not in ${project.key}, so it cannot be the parent`);
  }
  return parent.id;
}

/** The ids and the document the named references stand for; only what was given. */
export async function resolveIssueRefs(
  services: WorkServices,
  ctx: RequestContext,
  project: ProjectRef,
  refs: IssueRefs,
): Promise<UpdateIssueBody> {
  const body: UpdateIssueBody = {};
  const markdown = refs.descriptionText ?? refs.description;
  if (markdown !== undefined) body.description = markdown ? textDocument(markdown) : null;
  if (refs.type) body.typeId = await resolveTypeId(services, ctx, project, refs.type);
  if (refs.status) body.statusId = await resolveStatusId(services, ctx, project, refs.status);
  if (refs.assigneeEmail) {
    body.assigneeId = await resolveAssigneeId(services, ctx, project, refs.assigneeEmail);
  }
  if (refs.parentKey === null) body.parentId = null;
  else if (refs.parentKey) {
    body.parentId = await resolveParentId(services, ctx, project, refs.parentKey);
  }
  return body;
}
