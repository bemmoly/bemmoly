import { useState } from 'react';
import { useWhoAmI } from '../../../hooks/use-setup.ts';
import {
  expectedPrincipal,
  guideSteps,
  type ConnectMode,
  type GuideInput,
  type GuideSignIn,
} from './guide-steps.ts';
import { suggestionsOf, valuesOf, type GuideDraft, type GuideField } from './guide-values.ts';
import { EMPTY_REACH, readReach, type ReachDraft } from './reach-draft.ts';

/**
 * The choices on Connect a cloud and the steps they lead to: what Pipelines does (attach or
 * create projects), how Bemmoly signs in, what it may reach, and each value the steps' commands
 * need. `onChange` runs on every change, so a check never outlives the choices it checked.
 */
export function useGuide(onChange: () => void) {
  const [mode, setModeState] = useState<ConnectMode>('attached');
  const [signIn, setSignInState] = useState<GuideSignIn | null>(null);
  const [credentialFile, setCredentialFileState] = useState<Record<string, unknown> | null>(null);
  const [reach, setReachDraft] = useState<ReachDraft>(EMPTY_REACH);
  const [draft, setDraft] = useState<GuideDraft>({});
  const whoAmI = useWhoAmI(signIn);
  const read = readReach(reach);
  const firstProject =
    read.ok && read.reach.kind === 'projects' ? (read.reach.projects[0] ?? null) : null;
  const signedInAs = whoAmI.data?.signedIn ? whoAmI.data.principal : null;
  const suggested = suggestionsOf({ principal: signedInAs, signIn, firstProject, draft });
  const values = valuesOf(draft, suggested);
  const input: GuideInput | null = signIn ? { mode, signIn, values, reach: read } : null;
  const changed =
    <T>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value);
      onChange();
    };
  return {
    mode,
    setMode: changed(setModeState),
    signIn,
    setSignIn: changed((value: GuideSignIn) => {
      setSignInState(value);
      setCredentialFileState(null);
    }),
    credentialFile,
    setCredentialFile: changed(setCredentialFileState),
    reach,
    read,
    setReach: changed((patch: Partial<ReachDraft>) =>
      setReachDraft((now) => ({ ...now, ...patch })),
    ),
    values,
    /** The value shown in a field: typed, or the suggestion until something is typed. */
    valueOf: (field: GuideField) => draft[field] ?? suggested[field] ?? '',
    suggestedOnly: (field: GuideField) =>
      draft[field] === undefined && suggested[field] !== undefined,
    setValue: changed(([field, value]: [GuideField, string]) =>
      setDraft((now) => ({ ...now, [field]: value })),
    ),
    steps: input ? guideSteps(input) : [],
    expected: input ? expectedPrincipal(input) : null,
  };
}

export type Guide = ReturnType<typeof useGuide>;
