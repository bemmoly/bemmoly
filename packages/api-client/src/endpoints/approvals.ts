import {
  approvalDelegationResponseSchema,
  approvalRequestPageSchema,
  approvalRequestSchema,
  approvalWorkflowListSchema,
  approvalWorkflowSchema,
  decideApprovalBodySchema,
  delegationBodySchema,
  saveWorkflowBodySchema,
  withdrawApprovalBodySchema,
  type DecideApprovalBody,
  type DelegationBody,
  type ListApprovalsQuery,
  type SaveWorkflowBody,
  type WithdrawApprovalBody,
} from '@bemmoly/shared/approvals';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const REQUESTS = '/api/v1/approval-requests';
const DELEGATION = '/api/v1/approval-delegations/me';
const WORKFLOWS = '/api/v1/admin/approval-workflows';

/** TanStack Query keys for approvals; a decision clears the root, so every list refetches. */
export const approvalKeys = {
  all: () => ['approvals'] as const,
  list: (query: ListApprovalsQuery = {}) => ['approvals', 'list', query] as const,
  request: (id: string) => ['approvals', 'request', id] as const,
  delegation: () => ['approvals', 'delegation'] as const,
  workflows: (moduleId?: string) => ['approvals', 'workflows', moduleId ?? null] as const,
};

/**
 * The approval engine (ADR 0051): what waits on me across products, one request, decisions,
 * withdrawals, my delegate, and the admins' workflow definitions. A subpath export, so only
 * the screens that use it carry its schemas (ADR 0018).
 */
export function approvalEndpoints(http: Http) {
  return {
    list: async (query: ListApprovalsQuery = {}) =>
      http.request(REQUESTS, approvalRequestPageSchema, {
        query: {
          scope: query.scope,
          moduleId: query.moduleId,
          cursor: query.cursor,
          limit: query.limit,
        },
      }),
    get: async (id: string) => http.request(`${REQUESTS}/${enc(id)}`, approvalRequestSchema),
    decide: async (id: string, body: DecideApprovalBody) =>
      http.request(`${REQUESTS}/${enc(id)}/decisions`, approvalRequestSchema, {
        method: 'POST',
        body: validated(decideApprovalBodySchema, body),
      }),
    withdraw: async (id: string, body: WithdrawApprovalBody = {}) =>
      http.request(`${REQUESTS}/${enc(id)}/withdraw`, approvalRequestSchema, {
        method: 'POST',
        body: validated(withdrawApprovalBodySchema, body),
      }),
    delegation: async () => http.request(DELEGATION, approvalDelegationResponseSchema),
    setDelegation: async (body: DelegationBody) =>
      http.request(DELEGATION, approvalDelegationResponseSchema, {
        method: 'PUT',
        body: validated(delegationBodySchema, body),
      }),
    clearDelegation: async () => http.send(DELEGATION, { method: 'DELETE' }),
    workflows: async (moduleId?: string) =>
      http.request(WORKFLOWS, approvalWorkflowListSchema, { query: { moduleId } }),
    workflow: async (id: string) => http.request(`${WORKFLOWS}/${enc(id)}`, approvalWorkflowSchema),
    /** Every save is a new version; requests already running keep theirs. */
    saveWorkflow: async (body: SaveWorkflowBody) =>
      http.request(WORKFLOWS, approvalWorkflowSchema, {
        method: 'POST',
        body: validated(saveWorkflowBodySchema, body),
      }),
  };
}
