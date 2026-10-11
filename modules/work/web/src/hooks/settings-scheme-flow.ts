import type { SchemeKind } from '@bemmoly/module-work/shared';
import { useState } from 'react';
import type { ChangeConfirm } from '../settings/model/risks.ts';
import { useSchemeDiff, useSchemes } from './settings-schemes.ts';

const NOUN: Record<SchemeKind, string> = {
  issue_types: 'issue types',
  fields: 'fields',
  workflow: 'workflow',
  board: 'board',
};

type Step = 'view' | 'reset' | 'confirm-reset' | 'confirm-override';

/**
 * Override and reset for one scheme of a project, each reviewed first:
 * overriding asks before the project stops following the org default, and
 * resetting shows the diff that goes back, then asks for a typed word.
 */
export function useSchemeFlow(projectId: string | undefined, kind: SchemeKind) {
  const schemes = useSchemes(projectId);
  const [step, setStep] = useState<Step | null>(null);
  const diff = useSchemeDiff(projectId, kind, step === 'view' || step === 'reset');
  const status = schemes.status(kind);
  const noun = NOUN[kind];
  const close = () => setStep(null);

  const overrideAsk: ChangeConfirm = {
    title: `Override the ${noun} for this project?`,
    description: `The project gets its own copy of ${status?.originName ?? 'the org default'}.`,
    consequences: [
      `You can then change this project's ${noun} without touching other projects.`,
      `Later changes to the org default no longer reach this project until you reset it.`,
    ],
    confirmLabel: `Override ${noun}`,
    tone: 'caution',
  };
  const count = diff.data?.entries.length ?? status?.overrideCount ?? 0;
  const resetAsk: ChangeConfirm = {
    title: `Reset the ${noun} to the org default?`,
    description: 'The project copy is dropped and the org default applies again.',
    consequences: [
      `${count} ${count === 1 ? 'change' : 'changes'} made on this project ${count === 1 ? 'is' : 'are'} lost.`,
      `Issues keep their values; ${noun} only on this project stop being offered.`,
    ],
    confirmWord: 'reset',
    confirmLabel: 'Reset to org default',
    tone: 'danger',
  };

  return {
    status,
    schemes: schemes.list.data?.items ?? [],
    diff,
    step,
    viewDiff: () => setStep('view'),
    startReset: () => setStep('reset'),
    startOverride: () => setStep('confirm-override'),
    continueReset: () => setStep('confirm-reset'),
    close,
    override: schemes.override,
    reset: schemes.reset,
    overrideAsk,
    resetAsk,
    confirmOverride: () => schemes.override.mutate(kind, { onSuccess: close }),
    confirmReset: () => schemes.reset.mutate(kind, { onSuccess: close }),
  };
}

export type SchemeFlow = ReturnType<typeof useSchemeFlow>;
