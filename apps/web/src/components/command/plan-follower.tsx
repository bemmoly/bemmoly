import { queryKeys } from '@bemmoly/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../../lib/api.ts';
import { toast, undoToast } from '../../lib/toast.ts';
import { useUiStore } from '../../store/ui.ts';
import { planRows } from './palette-plan-steps.tsx';

const ACTIVE = new Set(['approved', 'running']);

/**
 * Follows a palette plan after the palette closes: the run keeps going on the server, and
 * when it ends the person hears how it went, with Undo. A plan already finished when the
 * palette closed was seen there, so it is let go quietly.
 */
export default function PlanFollower({ id }: { id: string }) {
  const client = useQueryClient();
  const setPlanId = useUiStore((state) => state.setAiPlanId);
  const wasRunning = useRef(false);
  const plan = useQuery({
    queryKey: queryKeys.ai.plan(id),
    queryFn: () => api.ai.plans.get(id),
    refetchInterval: (query) => (ACTIVE.has(query.state.data?.status ?? 'done') ? 1500 : false),
  });
  const status = plan.data?.status;

  useEffect(() => {
    if (plan.isError) setPlanId(null);
    if (!plan.data || !status) return;
    if (ACTIVE.has(status)) {
      wasRunning.current = true;
      return;
    }
    setPlanId(null);
    if (!wasRunning.current || status === 'proposed') return;
    void client.invalidateQueries({ queryKey: queryKeys.work() });
    void client.invalidateQueries({ queryKey: queryKeys.docs() });
    // Counted as the palette counts them: one note on both issues is one change.
    const rows = planRows(plan.data, '');
    const done = rows.filter((row) => row.status === 'done').length;
    const failed = rows.filter((row) => row.status === 'failed').length;
    const undoable = plan.data.steps.some((step) => step.undoable);
    const title =
      failed > 0
        ? `Plan finished: ${done} made, ${failed} failed`
        : `Plan finished: ${done} ${done === 1 ? 'change' : 'changes'} made`;
    if (undoable) {
      undoToast(title, () => {
        void api.ai.plans.undo(id).then(() => {
          void client.invalidateQueries({ queryKey: queryKeys.work() });
          toast('Plan undone');
        });
      });
    } else {
      toast(title, failed > 0 ? 'danger' : 'ok');
    }
  }, [status, plan.data, plan.isError, client, id, setPlanId]);

  return null;
}
