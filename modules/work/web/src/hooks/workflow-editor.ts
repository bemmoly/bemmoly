import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { WorkflowRule } from '../../../shared/index.ts';
import {
  addStatus,
  moveStatus,
  removeStatus,
  statusById,
  transitionById,
  updateStatus,
  type Selection,
  type StatusPatch,
} from '../workflow/draft-model.ts';
import {
  addRule,
  addTransition,
  removeRule,
  removeTransition,
  updateRuleArgs,
  updateTransition,
  type RuleSlot,
  type TransitionPatch,
} from '../workflow/draft-transitions.ts';
import { useWorkflowDraft } from './workflow-draft.ts';
import { workflowCountsQuery, workflowQuery, workflowRulesQuery } from './workflow-queries.ts';
import { useWorkflowValidation } from './workflow-validate.ts';

/** Arrow keys move a focused node this far; with Shift, one unit for fine placement. */
export const NUDGE = { step: 10, fine: 1 } as const;

/**
 * Everything the workflow editor screen does, so its components only draw:
 * the published workflow, the draft and its autosave, the selection, every
 * edit, validation, and the delete that waits for confirmation.
 */
export function useWorkflowEditor(workflowId: string) {
  const workflow = useQuery(workflowQuery(workflowId));
  const rules = useQuery(workflowRulesQuery());
  const counts = useQuery(workflowCountsQuery(workflowId));
  const draftState = useWorkflowDraft(workflowId);
  const validation = useWorkflowValidation(workflowId, draftState.flush);
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingDelete, setPendingDelete] = useState<Selection>(null);
  const { edit, draft } = draftState;

  const actions = useMemo(
    () => ({
      select: setSelection,
      addStatus: () =>
        edit((current) => {
          const result = addStatus(current);
          setSelection({ kind: 'status', id: result.id });
          return result.draft;
        }),
      moveStatus: (id: string, x: number, y: number) =>
        edit((current) => moveStatus(current, id, x, y)),
      nudgeStatus: (id: string, dx: number, dy: number) =>
        edit((current) => {
          const status = statusById(current, id);
          return status
            ? moveStatus(current, id, (status.x ?? 0) + dx, (status.y ?? 0) + dy)
            : current;
        }),
      updateStatus: (id: string, patch: StatusPatch) =>
        edit((current) => updateStatus(current, id, patch)),
      connect: (fromStatusId: string | null, toStatusId: string) =>
        edit((current) => {
          const result = addTransition(current, fromStatusId, toStatusId);
          setSelection({ kind: 'transition', id: result.id });
          return result.draft;
        }),
      updateTransition: (id: string, patch: TransitionPatch) =>
        edit((current) => updateTransition(current, id, patch)),
      addRule: (id: string, slot: RuleSlot, rule: WorkflowRule) =>
        edit((current) => addRule(current, id, slot, rule)),
      updateRule: (id: string, slot: RuleSlot, index: number, args: Record<string, unknown>) =>
        edit((current) => updateRuleArgs(current, id, slot, index, args)),
      removeRule: (id: string, slot: RuleSlot, index: number) =>
        edit((current) => removeRule(current, id, slot, index)),
      requestDelete: (target: Selection) => setPendingDelete(target),
      cancelDelete: () => setPendingDelete(null),
    }),
    [edit],
  );

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    edit((current) =>
      target.kind === 'status'
        ? removeStatus(current, target.id)
        : removeTransition(current, target.id),
    );
    setSelection(null);
  }, [edit, pendingDelete]);

  /** What the delete confirmation names: the status and the transitions it takes along. */
  const deleteTarget = useMemo(() => {
    if (!pendingDelete || !draft) return null;
    if (pendingDelete.kind === 'transition') {
      const transition = transitionById(draft, pendingDelete.id);
      return transition ? { kind: 'transition' as const, name: transition.name, takes: 0 } : null;
    }
    const status = statusById(draft, pendingDelete.id);
    if (!status) return null;
    const takes = draft.transitions.filter(
      (transition) => transition.fromStatusId === status.id || transition.toStatusId === status.id,
    ).length;
    return {
      kind: 'status' as const,
      name: status.name,
      takes,
      issues: counts.data?.[status.id] ?? 0,
    };
  }, [counts.data, draft, pendingDelete]);

  return {
    workflow: workflow.data,
    workflowError: workflow.error,
    rules: rules.data ?? [],
    counts: counts.data,
    draftState,
    validation,
    selection,
    actions: { ...actions, confirmDelete },
    deleteTarget,
  };
}

export type WorkflowEditorModel = ReturnType<typeof useWorkflowEditor>;
