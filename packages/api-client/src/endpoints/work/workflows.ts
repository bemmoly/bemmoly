import {
  publishWorkflowBodySchema,
  putWorkflowDraftBodySchema,
  ruleCatalogResponseSchema,
  workflowSchema,
  workflowsResponseSchema,
  workflowStatusCountsSchema,
  workflowValidationResponseSchema,
  type PublishWorkflowBody,
  type PutWorkflowDraftBody,
} from '@bemmoly/module-work/shared';
import type { Http } from '../../http.ts';
import { enc, validated } from '../validate.ts';

const base = '/api/v1/work';

export const workWorkflowKeys = {
  list: (projectId: string) => ['work', 'project', projectId, 'workflows'] as const,
  one: (workflowId: string) => ['work', 'workflow', workflowId] as const,
  counts: (workflowId: string) => ['work', 'workflow', workflowId, 'counts'] as const,
  rules: () => ['work', 'workflow-rules'] as const,
};

/**
 * /api/v1/work/workflows: the editor reads a workflow with its published
 * statuses and transitions, saves its draft as it edits, validates it and
 * publishes it as the next version.
 */
export function workWorkflowEndpoints(http: Http) {
  return {
    list: async (projectId: string) =>
      (await http.request(`${base}/projects/${enc(projectId)}/workflows`, workflowsResponseSchema))
        .items,
    get: async (workflowId: string) =>
      http.request(`${base}/workflows/${enc(workflowId)}`, workflowSchema),
    /** The editor state, including the draft when one is saved. */
    draft: async (workflowId: string) =>
      http.request(`${base}/workflows/${enc(workflowId)}/draft`, putWorkflowDraftBodySchema),
    putDraft: async (workflowId: string, body: PutWorkflowDraftBody) =>
      http.request(`${base}/workflows/${enc(workflowId)}/draft`, putWorkflowDraftBodySchema, {
        method: 'PUT',
        body: validated(putWorkflowDraftBodySchema, body),
      }),
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
    statusCounts: async (workflowId: string) =>
      (
        await http.request(
          `${base}/workflows/${enc(workflowId)}/status-counts`,
          workflowStatusCountsSchema,
        )
      ).counts,
    /** Conditions, validators and post-actions the rules registry offers. */
    rules: async () =>
      (await http.request(`${base}/workflow-rules`, ruleCatalogResponseSchema)).items,
  };
}
