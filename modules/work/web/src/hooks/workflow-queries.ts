import { queryOptions } from '@tanstack/react-query';
import { workWorkflowKeys } from '../api/index.ts';
import { api } from '../shared/index.ts';

/** The workflow editor's reads, one options object each so hooks and tests share the keys. */

export const workflowsQuery = (projectId?: string) =>
  queryOptions({
    queryKey: workWorkflowKeys.list(projectId),
    queryFn: () => api.work.workflows.list(projectId),
  });

export const workflowQuery = (workflowId: string) =>
  queryOptions({
    queryKey: workWorkflowKeys.one(workflowId),
    queryFn: () => api.work.workflows.get(workflowId),
  });

/**
 * The saved draft. It is read once per opening and then owned by the editor
 * while it is open, so a background refetch never replaces what someone is
 * in the middle of changing.
 */
export const workflowDraftQuery = (workflowId: string) =>
  queryOptions({
    queryKey: workWorkflowKeys.draft(workflowId),
    queryFn: () => api.work.workflows.draft(workflowId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

/** The rules registry changes only with a release. */
export const workflowRulesQuery = () =>
  queryOptions({
    queryKey: workWorkflowKeys.rules(),
    queryFn: () => api.work.workflows.rules(),
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Issues per status; the canvas shows the category alone when the server has no counts. */
export const workflowCountsQuery = (workflowId: string) =>
  queryOptions({
    queryKey: workWorkflowKeys.counts(workflowId),
    queryFn: () => api.work.workflows.statusCounts(workflowId),
    retry: false,
  });
