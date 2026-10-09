import { useLeaveGuard } from '@bemmoly/core-web';
import { useEffect, useRef, useState } from 'react';
import type { WorkflowDraftState } from './workflow-draft.ts';

export interface DraftLeave {
  /** The last change did not save and the person is leaving: ask before it is lost. */
  asking: boolean;
  stay: () => void;
  leave: () => void;
}

/**
 * Holds a move away from the workflow editor while the draft has a change
 * the server does not have yet. The held move waits for the autosave to
 * finish and then goes on by itself; only when that save fails is the person
 * asked whether to stay or leave without it.
 */
export function useDraftLeaveGuard(
  draftState: Pick<WorkflowDraftState, 'saveState' | 'flush'>,
): DraftLeave {
  const guard = useLeaveGuard({ when: draftState.saveState !== 'saved' });
  const [failed, setFailed] = useState(false);
  const latest = useRef({ guard, flush: draftState.flush });
  useEffect(() => {
    latest.current = { guard, flush: draftState.flush };
  });

  useEffect(() => {
    if (!guard.blocked || failed) return;
    let live = true;
    latest.current
      .flush()
      .then(() => {
        if (live) latest.current.guard.leave();
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [guard.blocked, failed]);

  return {
    asking: guard.blocked && failed,
    stay: () => {
      setFailed(false);
      guard.stay();
    },
    leave: () => {
      setFailed(false);
      guard.leave();
    },
  };
}
