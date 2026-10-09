import {
  publishWorkflowBodySchema,
  putWorkflowDraftBodySchema,
  workflowRulesResponseSchema,
  workflowSchema,
  workflowsResponseSchema,
  workflowStatusCountsSchema,
  workflowValidationResponseSchema,
  type PublishWorkflowBody,
  type PutWorkflowDraftBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const base = '/api/v1/work';

export const workWorkflowKeys = {
  /** Every workflow the person can see, or the org defaults plus one project's own. */
  list: (projectId?: string) => ['work', 'workflows', projectId ?? 'all'] as const,
  one: (workflowId: string) => ['work', 'workflow', workflowId] as const,
  draft: (workflowId: string) => ['work', 'workflow', workflowId, 'draft'] as const,
  /** Every project's counts, or one project's; invalidating without a project reaches both. */
  counts: (workflowId: string, projectId?: string) =>
    projectId
      ? (['work', 'workflow', workflowId, 'counts', projectId] as const)
      : (['work', 'workflow', workflowId, 'counts'] as const),
  rules: () => ['work', 'workflow-rules'] as const,
};

/**
 * /api/v1/work/workflows: the editor reads a workflow with its published
 * statuses and transitions, saves its draft as it edits, validates it and
 * publishes it as the next version.
 */
export function workWorkflowEndpoints(http: Http) {
  return {
    /** With a project id: the org defaults and that project's own; without: every workflow. */
    list: async (projectId?: string) =>
      (
        await http.request(`${base}/workflows`, workflowsResponseSchema, {
          query: projectId ? { projectId } : {},
        })
      ).items,
    get: async (workflowId: string) =>
      http.request(`${base}/workflows/${enc(workflowId)}`, workflowSchema),
    /** The editor state: the saved draft, or the published workflow when none is saved. */
    draft: async (workflowId: string) =>
      (await http.request(`${base}/workflows/${enc(workflowId)}/draft`, putWorkflowDraftBodySchema))
        .draft,
    putDraft: async (workflowId: string, body: PutWorkflowDraftBody) =>
      (
        await http.request(
          `${base}/workflows/${enc(workflowId)}/draft`,
          putWorkflowDraftBodySchema,
          {
            method: 'PUT',
            body: validated(putWorkflowDraftBodySchema, body),
          },
        )
      ).draft,
    validate: async (workflowId: string) =>
      http.request(
        `${base}/workflows/${enc(workflowId)}/validate`,
        workflowValidationResponseSchema,
        { method: 'POST' },
      ),
    publish: async (workflowId: string, body: PublishWorkflowBody = {}) =>
      http.request(`${base}/workflows/${enc(workflowId)}/publish`, workflowSchema, {
        method: 'POST',
        body: validated(publishWorkflowBodySchema, body),
      }),
    /** Issues per status the person can see; a project id narrows it to that project's issues. */
    statusCounts: async (workflowId: string, projectId?: string) =>
      (
        await http.request(
          `${base}/workflows/${enc(workflowId)}/status-counts`,
          workflowStatusCountsSchema,
          { query: projectId ? { projectId } : {} },
        )
      ).counts,
    /** Conditions, validators and post-actions the rules registry offers, params as JSON Schema. */
    rules: async () =>
      (await http.request(`${base}/workflow-rules`, workflowRulesResponseSchema)).items,
  };
}
