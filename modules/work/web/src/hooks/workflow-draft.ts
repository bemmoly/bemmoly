import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workWorkflowKeys } from '../api/index.ts';
import { api } from '../shared/index.ts';
import { draftKey, withLayout, type EditorDraft } from '../workflow/draft-model.ts';
import { workflowDraftQuery } from './workflow-queries.ts';

/** How long the editor waits after the last change before it saves the draft. */
export const AUTOSAVE_DELAY_MS = 800;

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface WorkflowDraftState {
  /** The draft as the editor shows it, laid out; undefined until the first read. */
  draft: EditorDraft | undefined;
  isPending: boolean;
  loadError: unknown;
  saveState: SaveState;
  saveError: unknown;
  /** Replaces the draft with the result of an edit and schedules the save. */
  edit: (change: (draft: EditorDraft) => EditorDraft) => void;
  /** Saves now if a change is waiting; resolves once the server has the latest draft. */
  flush: () => Promise<void>;
  /** Drops local edits and reads the draft again, after a publish. */
  reset: () => Promise<void>;
}

/**
 * The editor's draft: read once, edited locally, saved with a debounced PUT.
 * Saves never overlap; a change made during a save is saved right after it,
 * so the server always ends on the last thing the person did.
 */
export function useWorkflowDraft(workflowId: string): WorkflowDraftState {
  const queryClient = useQueryClient();
  const query = useQuery(workflowDraftQuery(workflowId));
  const [edited, setEdited] = useState<EditorDraft | null>(null);
  const latest = useRef<EditorDraft | null>(null);
  const savedKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const mutation = useMutation({
    mutationFn: (draft: EditorDraft) => api.work.workflows.putDraft(workflowId, { draft }),
    onSuccess: (saved) => {
      queryClient.setQueryData(workWorkflowKeys.draft(workflowId), saved);
      void queryClient.invalidateQueries({ queryKey: workWorkflowKeys.one(workflowId) });
    },
  });
  const { mutateAsync } = mutation;

  const save = useCallback(async (): Promise<void> => {
    if (inFlight.current) await inFlight.current.catch(() => undefined);
    const draft = latest.current;
    if (!draft || draftKey(draft) === savedKey.current) {
      setSaveState('saved');
      return;
    }
    setSaveState('saving');
    const run = mutateAsync(draft).then(() => {
      savedKey.current = draftKey(draft);
    });
    inFlight.current = run;
    try {
      await run;
      setSaveState(
        latest.current && draftKey(latest.current) !== savedKey.current ? 'pending' : 'saved',
      );
    } catch (error) {
      setSaveState('error');
      throw error;
    } finally {
      if (inFlight.current === run) inFlight.current = null;
    }
  }, [mutateAsync]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save().catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
  }, [save]);

  const base = useMemo(() => (query.data ? withLayout(query.data) : undefined), [query.data]);
  const draft = edited ?? base;

  const edit = useCallback(
    (change: (draft: EditorDraft) => EditorDraft) => {
      const current = latest.current ?? base;
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      if (savedKey.current === null && query.data) savedKey.current = draftKey(query.data);
      latest.current = next;
      setEdited(next);
      setSaveState('pending');
      schedule();
    },
    [base, query.data, schedule],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await save();
  }, [save]);

  const reset = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = null;
    savedKey.current = null;
    setEdited(null);
    setSaveState('saved');
    await queryClient.invalidateQueries({ queryKey: workWorkflowKeys.draft(workflowId) });
  }, [queryClient, workflowId]);

  /** Leaving the editor saves what is waiting rather than dropping it. */
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void save().catch(() => undefined);
    },
    [save],
  );

  return {
    draft,
    isPending: query.isPending,
    loadError: query.error,
    saveState,
    saveError: mutation.error,
    edit,
    flush,
    reset,
  };
}
