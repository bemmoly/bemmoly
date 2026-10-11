import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  automationCatalogSchema,
  automationRuleSchema,
  automationRulesResponseSchema,
  automationRunSchema,
  automationRunsPageSchema,
  createAutomationRuleBodySchema,
  createAutomationRunBodySchema,
  updateAutomationRuleBodySchema,
  type CreateAutomationRuleBody,
  type ListAutomationRunsQuery,
  type UpdateAutomationRuleBody,
} from '../../../shared/index.ts';

const base = '/api/v1/work/automation';

export const automationKeys = {
  all: () => ['work', 'automation'] as const,
  catalog: () => ['work', 'automation', 'catalog'] as const,
  rules: (projectId: string | null) => ['work', 'automation', 'rules', projectId] as const,
  runs: (query: ListAutomationRunsQuery) => ['work', 'automation', 'runs', query] as const,
};

/** /api/v1/work/automation: a project's rules and the global ones, their catalog and run log. */
export function workAutomationEndpoints(http: Http) {
  return {
    catalog: async () => http.request(`${base}/catalog`, automationCatalogSchema),
    /** The project's own rules and every global one; without a project, global rules only. */
    rules: async (projectId: string | null) =>
      (
        await http.request(`${base}/rules`, automationRulesResponseSchema, {
          query: { projectId: projectId ?? undefined },
        })
      ).items,
    create: async (body: CreateAutomationRuleBody) =>
      http.request(`${base}/rules`, automationRuleSchema, {
        method: 'POST',
        body: validated(createAutomationRuleBodySchema, body),
      }),
    update: async (id: string, body: UpdateAutomationRuleBody) =>
      http.request(`${base}/rules/${enc(id)}`, automationRuleSchema, {
        method: 'PATCH',
        body: validated(updateAutomationRuleBodySchema, body),
      }),
    remove: async (id: string) => http.send(`${base}/rules/${enc(id)}`, { method: 'DELETE' }),
    /** Runs a saved rule now against one issue; the run lands in the log like any other. */
    test: async (id: string, issueKey: string) =>
      http.request(`${base}/rules/${enc(id)}/runs`, automationRunSchema, {
        method: 'POST',
        body: validated(createAutomationRunBodySchema, { issueKey }),
      }),
    runs: async (query: ListAutomationRunsQuery) =>
      http.request(`${base}/runs`, automationRunsPageSchema, {
        query: {
          cursor: query.cursor,
          limit: query.limit,
          status: query.status,
          ruleId: query.ruleId,
          projectId: query.projectId,
        },
      }),
  };
}
