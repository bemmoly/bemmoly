import { queryKeys } from '@bemmoly/api-client';
import type { AiPlan, AiPlanContext } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { aiProblemOf, type AiProblem } from '../lib/ai-problem.ts';
import { api } from '../lib/api.ts';
import { toast } from '../lib/toast.ts';

const ACTIVE = new Set<AiPlan['status']>(['approved', 'running']);

/**
 * One palette plan from request to result: draw it up, keep or drop steps (Edit plan), run
 * the allowed ones, follow the run (the realtime `ai.plan` announcement refetches it; a slow
 * poll covers a dropped socket), stop it, and undo it.
 */
export function useAiPlan() {
  const client = useQueryClient();
  const [planId, setPlanId] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<number> | null>(null);
  const store = (plan: AiPlan) => client.setQueryData(queryKeys.ai.plan(plan.id), plan);

  const create = useMutation({
    mutationFn: (input: { request: string; context?: AiPlanContext }) => api.ai.plans.create(input),
    onSuccess: (plan) => {
      store(plan);
      setPlanId(plan.id);
      setKept(null);
    },
  });

  const plan = useQuery({
    queryKey: queryKeys.ai.plan(planId ?? ''),
    queryFn: () => api.ai.plans.get(planId ?? ''),
    enabled: planId !== null,
    refetchInterval: (query) => (ACTIVE.has(query.state.data?.status ?? 'done') ? 2000 : false),
  });

  const settle = (next: AiPlan) => {
    store(next);
    // What the plan changed shows on every open screen, whatever the socket did.
    void client.invalidateQueries({ queryKey: queryKeys.work() });
    void client.invalidateQueries({ queryKey: queryKeys.docs() });
  };

  const run = useMutation({
    mutationFn: (id: string) =>
      api.ai.plans.run(id, kept ? { steps: [...kept].sort((a, b) => a - b) } : {}),
    onSuccess: (next) => {
      store(next);
      setKept(null);
    },
  });
  const stop = useMutation({
    mutationFn: (id: string) => api.ai.plans.cancel(id),
    onSuccess: settle,
  });
  const undo = useMutation({
    mutationFn: (id: string) => api.ai.plans.undo(id),
    onSuccess: (next) => {
      settle(next);
      toast('Plan undone');
    },
  });
  const notUseful = useMutation({
    mutationFn: (runId: string) => api.ai.answers.feedback(runId, 'not_useful'),
    onSuccess: () => toast('Thanks. That helps tune Bemmoly’s plans.', 'info'),
  });

  const current = planId ? plan.data : undefined;
  const failure = create.error ?? run.error ?? stop.error ?? undo.error;
  const problem: AiProblem | null = failure ? aiProblemOf(failure) : null;
  const status = current?.status;
  useEffect(() => {
    // A finished run refreshes the screens once, when its last step lands.
    if (status === 'done' || status === 'failed') {
      void client.invalidateQueries({ queryKey: queryKeys.work() });
      void client.invalidateQueries({ queryKey: queryKeys.docs() });
    }
  }, [status, client]);

  return {
    plan: current,
    thinking: create.isPending,
    problem,
    busy: run.isPending || stop.isPending || undo.isPending,
    editing: kept !== null,
    kept,
    start: (request: string, context?: AiPlanContext) => {
      run.reset();
      stop.reset();
      undo.reset();
      create.mutate(context ? { request, context } : { request });
    },
    /** Edit plan toggles choosing; it starts with every allowed step kept. */
    edit: () =>
      setKept((now) =>
        now
          ? null
          : new Set(
              (current?.steps ?? []).filter((s) => s.permission === 'ALLOWED').map((s) => s.index),
            ),
      ),
    toggle: (index: number) =>
      setKept((now) => {
        const next = new Set(now ?? []);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      }),
    run: () => current && current.status === 'proposed' && run.mutate(current.id),
    stop: () => current && stop.mutate(current.id),
    undo: () => current && undo.mutate(current.id),
    notUseful: () => current?.runId && notUseful.mutate(current.runId),
    reset: () => {
      create.reset();
      setPlanId(null);
      setKept(null);
    },
  };
}

export type AiPlanState = ReturnType<typeof useAiPlan>;
