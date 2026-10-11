import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { WorkflowProblem } from '../../../shared/index.ts';
import { api } from '../shared/index.ts';

export interface WorkflowValidation {
  /** Saves what is waiting, then asks the server to check the draft. */
  run: () => Promise<WorkflowProblem[]>;
  isValidating: boolean;
  /** Null until Validate has run since the panel opened or the last publish. */
  problems: WorkflowProblem[] | null;
  error: unknown;
  /** Statuses and transitions a problem names, for the canvas to mark. */
  invalidStatuses: ReadonlySet<string>;
  invalidTransitions: ReadonlySet<string>;
  clear: () => void;
}

/**
 * Validate runs against the saved draft, so it flushes the autosave first;
 * the problems stay on screen until the next run, so fixing one does not
 * make the rest disappear before the person has read them.
 */
export function useWorkflowValidation(
  workflowId: string,
  flush: () => Promise<void>,
): WorkflowValidation {
  const mutation = useMutation({
    mutationFn: async () => {
      await flush();
      return api.work.workflows.validate(workflowId);
    },
  });
  const { mutateAsync, reset } = mutation;
  const problems = mutation.data?.problems ?? null;

  const run = useCallback(async () => (await mutateAsync()).problems, [mutateAsync]);

  const marks = useMemo(() => {
    const statuses = new Set<string>();
    const transitions = new Set<string>();
    for (const problem of problems ?? []) {
      if (problem.statusId) statuses.add(problem.statusId);
      if (problem.transitionId) transitions.add(problem.transitionId);
    }
    return { statuses, transitions };
  }, [problems]);

  return {
    run,
    isValidating: mutation.isPending,
    problems,
    error: mutation.error,
    invalidStatuses: marks.statuses,
    invalidTransitions: marks.transitions,
    clear: reset,
  };
}
