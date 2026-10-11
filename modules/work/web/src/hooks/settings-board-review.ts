import { useState } from 'react';
import { boardConfigDiff } from '../settings/model/diff.ts';
import { resetRisk } from '../settings/model/risks.ts';
import type { BoardSection } from '../settings/model/sections.ts';
import type { BoardSettings, PreparedSave } from './settings-board.ts';

type Step = 'review' | 'confirm';

/**
 * The way a Board settings change is written: the diff first, then, when the
 * change hides cards or drops settings, ConfirmChange saying what happens,
 * and only then the request. The same steps reset the board to the org
 * default, with a typed word because the project's settings are replaced.
 */
export function useBoardReview(settings: BoardSettings, onSaved: (section: BoardSection) => void) {
  const [save, setSave] = useState<{ prepared: PreparedSave; step: Step } | null>(null);
  const [reset, setReset] = useState<Step | null>(null);
  const [viewing, setViewing] = useState(false);

  const write = (prepared: PreparedSave) =>
    settings.save.mutate(prepared, {
      onSuccess: () => {
        setSave(null);
        onSaved(prepared.section);
      },
    });

  const resetChanges =
    settings.stored && settings.orgConfig
      ? boardConfigDiff(settings.stored.config, settings.orgConfig, settings.statusName)
      : [];

  return {
    /** Opens the review of a tab's save; nothing is sent until it is confirmed. */
    start: (section: BoardSection) => {
      const prepared = settings.prepare(section);
      if (prepared && prepared.problems.length === 0) {
        settings.save.reset();
        setSave({ prepared, step: 'review' });
      }
    },
    saveReview: {
      open: save?.step === 'review',
      entries: save?.prepared.changes ?? [],
      busy: settings.save.isPending,
      onClose: () => setSave(null),
      onConfirm: () => {
        if (!save) return;
        if (save.prepared.risk) setSave({ ...save, step: 'confirm' });
        else write(save.prepared);
      },
    },
    saveRisk: save?.step === 'confirm' ? save.prepared.risk : null,
    confirmSaveRisk: () => save && write(save.prepared),
    cancelSaveRisk: () => setSave(null),

    resetChanges,
    startReset: () => {
      settings.reset.reset();
      setReset('review');
    },
    resetReview: {
      open: reset === 'review',
      entries: resetChanges,
      onClose: () => setReset(null),
      onConfirm: () => setReset('confirm'),
    },
    resetRisk: reset === 'confirm' ? resetRisk(resetChanges.length) : null,
    confirmReset: () => settings.reset.mutate(undefined, { onSuccess: () => setReset(null) }),
    cancelReset: () => setReset(null),

    viewing,
    setViewing,
  };
}

export type BoardReview = ReturnType<typeof useBoardReview>;
