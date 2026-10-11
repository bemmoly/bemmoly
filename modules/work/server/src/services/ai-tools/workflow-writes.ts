import { defineReadTool, defineWriteTool, type RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import {
  publishWorkflowBodySchema,
  workflowDraftSchema,
  type Workflow,
  type WorkflowDraft,
} from '../../../../shared/workflows.ts';
import type { WorkServices } from '../index.ts';
import { validateDraft } from '../workflow/index.ts';

/*
 * Workflow editing for admins, through the same workflow service the editor calls: a tool reads
 * the workflow, one saves a draft and one publishes it. Saving and publishing both need
 * work.project.configure, which only admins hold, so a plan step from anyone else is denied.
 * A saved draft can be undone; a publish cannot, as it moves issues off removed statuses.
 */

const workflowIdInput = z.object({ workflowId: z.uuid() });
const getInput = z.object({ projectId: z.uuid() });
const draftInput = workflowIdInput.extend({ draft: workflowDraftSchema });
const publishInput = workflowIdInput.extend({
  statusMapping: publishWorkflowBodySchema.shape.statusMapping,
});

type DraftUndo = { workflowId: string; draft: WorkflowDraft | null };

/** "To Do → In Progress → Done": the statuses in order, as a preview's from and to. */
const statusLine = (statuses: ReadonlyArray<{ name: string; position: number }>) =>
  [...statuses]
    .sort((a, b) => a.position - b.position)
    .map((status) => status.name)
    .join(' → ')
    .slice(0, 200);

function requireValid(draft: WorkflowDraft): void {
  const { valid, problems } = validateDraft(draft);
  if (!valid) throw new ValidationError(problems[0]?.message ?? 'The workflow draft has problems');
}

export function workflowTools(services: WorkServices) {
  const workflows = services.workflow;

  /** The draft as the editor would open it; also the admin check, as reading it needs configure. */
  const draftOf = (ctx: RequestContext, id: string) => workflows.getDraft(ctx, id);

  const getWorkflow = defineReadTool({
    name: 'work_get_workflow',
    kind: 'read',
    description:
      'Read the workflow a project uses (projectId from work_get_project): its statuses and ' +
      'transitions with ids, and the unpublished draft when the person may edit it.',
    input: getInput,
    execute: async (ctx, { projectId }) => {
      const all = await workflows.list(ctx, projectId);
      const workflow: Workflow | undefined =
        all.find((item) => item.projectId === projectId) ?? all.find((item) => !item.projectId);
      if (!workflow) return null;
      const draft = await draftOf(ctx, workflow.id).catch(() => null);
      return {
        id: workflow.id,
        name: workflow.name,
        projectId: workflow.projectId,
        publishedVersion: workflow.publishedVersion,
        hasDraft: workflow.hasDraft,
        statuses: workflow.statuses.map(({ id, name, category, position }) => ({
          id,
          name,
          category,
          position,
        })),
        transitions: workflow.transitions.map(({ id, name, fromStatusId, toStatusId }) => ({
          id,
          name,
          fromStatusId,
          toStatusId,
        })),
        draft,
      };
    },
  });

  const saveDraft = defineWriteTool<z.infer<typeof draftInput>, DraftUndo>({
    name: 'work_save_workflow_draft',
    kind: 'write',
    description:
      'Admins only. Save a whole workflow draft (statuses and transitions) without publishing ' +
      'it. Start from the draft work_get_workflow returns; new statuses and transitions take ' +
      'any new id string, kept ones keep their id.',
    input: draftInput,
    idempotent: true,
    describe: async (ctx, { workflowId, draft }) => {
      const workflow = await workflows.get(ctx, workflowId);
      return {
        target: workflow.name,
        change: `${draft.statuses.length} statuses, ${draft.transitions.length} transitions`,
        field: 'Workflow draft',
        from: statusLine(workflow.statuses),
        to: statusLine(draft.statuses),
        href: null,
      };
    },
    authorize: async (ctx, { workflowId, draft }) => {
      await draftOf(ctx, workflowId);
      requireValid(draft);
    },
    run: async (ctx, { workflowId, draft }) => {
      const before = await workflows.get(ctx, workflowId);
      const prior = before.hasDraft ? await draftOf(ctx, workflowId) : null;
      await workflows.putDraft(ctx, workflowId, draft);
      return { undo: { workflowId, draft: prior } };
    },
    undo: async (ctx, { workflowId, draft }) => {
      if (draft) await workflows.putDraft(ctx, workflowId, draft);
      else await workflows.discardDraft(ctx, workflowId);
    },
  });

  const publish = defineWriteTool<z.infer<typeof publishInput>, null>({
    name: 'work_publish_workflow',
    kind: 'write',
    description:
      'Admins only. Publish the saved workflow draft. When the draft drops a status issues ' +
      'still use, statusMapping maps each removed status id to a draft status id. Cannot be ' +
      'undone.',
    input: publishInput,
    // Publishing takes the draft away, so a second run finds nothing to publish.
    idempotent: false,
    describe: async (ctx, { workflowId }) => {
      const workflow = await workflows.get(ctx, workflowId);
      const draft = workflow.hasDraft ? await draftOf(ctx, workflowId) : null;
      return {
        target: workflow.name,
        change: `Publish version ${workflow.publishedVersion + 1}`,
        field: 'Workflow',
        from: statusLine(workflow.statuses),
        to: draft ? statusLine(draft.statuses) : 'No draft',
        href: null,
      };
    },
    authorize: async (ctx, { workflowId }) => {
      const draft = await draftOf(ctx, workflowId);
      if (!(await workflows.get(ctx, workflowId)).hasDraft) {
        throw new ValidationError('There is no draft to publish');
      }
      requireValid(draft);
    },
    run: async (ctx, { workflowId, statusMapping }) => {
      await workflows.publish(ctx, workflowId, { statusMapping });
      return { undo: null };
    },
  });

  return [getWorkflow, saveDraft, publish];
}
