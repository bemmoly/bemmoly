import { isApiError } from '@bemmoly/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { workflowProblemSchema, type Workflow } from '../../../shared/index.ts';
import { workWorkflowKeys } from '../api/index.ts';
import { api } from '../shared/index.ts';

/** A removed status that still holds issues; publish waits for where they should go. */
export interface StatusToMap {
  statusId: string;
  name: string;
  issues: number;
}

const refusalSchema = z.object({
  problems: z.array(workflowProblemSchema).optional(),
  statusMappingRequired: z
    .array(z.object({ statusId: z.string(), name: z.string(), issues: z.number() }))
    .optional(),
});

/** What the server said when it refused the publish, read from the error details. */
export function publishRefusal(error: unknown) {
  if (!isApiError(error)) return { problems: [], statusMappingRequired: [] as StatusToMap[] };
  const parsed = refusalSchema.safeParse(error.details);
  return {
    problems: parsed.success ? (parsed.data.problems ?? []) : [],
    statusMappingRequired: parsed.success ? (parsed.data.statusMappingRequired ?? []) : [],
  };
}

export interface PublishWorkflow {
  /** Saves what is waiting, then publishes the draft as the next version. */
  publish: (statusMapping?: Record<string, string>) => Promise<Workflow>;
  isPublishing: boolean;
  error: unknown;
  refusal: ReturnType<typeof publishRefusal>;
  reset: () => void;
}

/**
 * Publish makes the draft the workflow's next version. The server refuses a
 * draft with problems or one that drops a status still holding issues; both
 * come back as details the confirmation can show.
 */
export function usePublishWorkflow(
  workflowId: string,
  flush: () => Promise<void>,
  onPublished: (workflow: Workflow) => Promise<void> | void,
): PublishWorkflow {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (statusMapping: Record<string, string>) => {
      await flush();
      return api.work.workflows.publish(workflowId, { statusMapping });
    },
    onSuccess: async (workflow) => {
      queryClient.setQueryData(workWorkflowKeys.one(workflowId), workflow);
      await onPublished(workflow);
      await queryClient.invalidateQueries({ queryKey: ['work', 'workflows'] });
      await queryClient.invalidateQueries({ queryKey: workWorkflowKeys.counts(workflowId) });
    },
  });
  const { mutateAsync } = mutation;
  const publish = useCallback(
    (statusMapping: Record<string, string> = {}) => mutateAsync(statusMapping),
    [mutateAsync],
  );
  return {
    publish,
    isPublishing: mutation.isPending,
    error: mutation.error,
    refusal: publishRefusal(mutation.error),
    reset: mutation.reset,
  };
}
