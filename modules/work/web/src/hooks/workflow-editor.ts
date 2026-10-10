import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
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

/** How many steps Undo can walk back; older ones fall off. */
const HISTORY = 50;

/** What a delete took, for the Undo toast: the item and the transitions it took along. */
export interface DeletedItem {
  kind: 'status' | 'transition';
  name: string;
  takes: number;
}

/**
 * Everything the workflow editor screen does, so its components only draw:
 * the published workflow, the draft and its autosave, the selection, every
 * edit with an Undo history, validation, and deletes that happen at once
 * (the draft is not live until it is published, so Undo beats a confirmation).
 */
export function useWorkflowEditor(workflowId: string, onDeleted?: (item: DeletedItem) => void) {
  const deleted = useRef(onDeleted);
  deleted.current = onDeleted;
  const workflow = useQuery(workflowQuery(workflowId));
  const rules = useQuery(workflowRulesQuery());
  const counts = useQuery(workflowCountsQuery(workflowId));
  const draftState = useWorkflowDraft(workflowId);
  const validation = useWorkflowValidation(workflowId, draftState.flush);
  const [selection, setSelection] = useState<Selection>(null);
  const { edit: save, draft } = draftState;
  const history = useRef<NonNullable<typeof draft>[]>([]);
  const [undoable, setUndoable] = useState(0);
  const edit = useCallback(
    (change: Parameters<typeof save>[0]) =>
      save((current) => {
        const next = change(current);
        if (next !== current) {
          history.current = [...history.current, current].slice(-HISTORY);
          setUndoable(history.current.length);
        }
        return next;
      }),
    [save],
  );
  const undo = useCallback(() => {
    const previous = history.current.at(-1);
    if (!previous) return;
    history.current = history.current.slice(0, -1);
    setUndoable(history.current.length);
    setSelection(null);
    save(() => previous);
  }, [save]);

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
    }),
    [edit],
  );

  /** Deletes now and tells the caller what went, so it can offer Undo. */
  const remove = useCallback(
    (target: Selection): DeletedItem | null => {
      if (!target || !draft) return null;
      let item: DeletedItem | null = null;
      if (target.kind === 'transition') {
        const transition = transitionById(draft, target.id);
        if (transition) item = { kind: 'transition', name: transition.name, takes: 0 };
      } else {
        const status = statusById(draft, target.id);
        if (status)
          item = {
            kind: 'status',
            name: status.name,
            takes: draft.transitions.filter(
              (t) => t.fromStatusId === status.id || t.toStatusId === status.id,
            ).length,
          };
      }
      if (!item) return null;
      edit((current) =>
        target.kind === 'status'
          ? removeStatus(current, target.id)
          : removeTransition(current, target.id),
      );
      setSelection(null);
      deleted.current?.(item);
      return item;
    },
    [draft, edit],
  );

  return {
    workflow: workflow.data,
    workflowError: workflow.error,
    rules: rules.data ?? [],
    counts: counts.data,
    draftState,
    validation,
    selection,
    actions: { ...actions, requestDelete: remove, undo },
    canUndo: undoable > 0,
  };
}

export type WorkflowEditorModel = ReturnType<typeof useWorkflowEditor>;
