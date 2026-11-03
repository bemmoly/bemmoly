import {
  grantCommand,
  type CloudAccessCheckBody,
  type CloudAccessCheckResponse,
} from '@bemmoly/module-pipelines/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api.ts';
import { useAccessCheck, useReturnToChecklist, useWhoAmI } from '../../../hooks/use-setup.ts';
import { EMPTY_REACH, readReach, type ReachDraft } from './reach-draft.ts';

export type SignInChoice = CloudAccessCheckBody['signIn'];

/**
 * Connect a cloud: the two choices the person makes (how Bemmoly signs in, what it may reach),
 * the grant command for exactly those, Check access, and Connect. A changed choice clears the
 * last check, so what is connected is always what was checked.
 */
export function useConnectCloud(connectedMessage: string, name: string) {
  const [signIn, setSignIn] = useState<SignInChoice | null>(null);
  const [credentialFile, setCredentialFile] = useState<Record<string, unknown> | null>(null);
  const [reach, setReachDraft] = useState<ReachDraft>(EMPTY_REACH);
  const [checked, setChecked] = useState<CloudAccessCheckResponse | null>(null);
  const whoAmI = useWhoAmI(signIn);
  const check = useAccessCheck();
  const back = useReturnToChecklist();
  const read = readReach(reach);
  const signInReady = signIn !== null && (signIn !== 'workload_identity_file' || !!credentialFile);
  const ready = signInReady && read.ok;
  const principal = checked?.principal ?? whoAmI.data?.principal ?? null;
  const body = (): CloudAccessCheckBody | null =>
    ready && signIn && read.ok
      ? {
          provider: 'gcp',
          signIn,
          ...(credentialFile ? { credentialFile } : {}),
          reach: read.reach,
        }
      : null;
  const connect = useMutation({
    mutationFn: () => {
      const choices = body();
      if (!choices) throw new Error('choose how Bemmoly signs in and what it reaches first');
      return api.platform.connect({ ...choices, name, mode: 'attached' });
    },
    onSuccess: () => back(connectedMessage),
  });
  return {
    signIn,
    setSignIn: (value: SignInChoice) => {
      setSignIn(value);
      setChecked(null);
    },
    credentialFile,
    setCredentialFile: (file: Record<string, unknown> | null) => {
      setCredentialFile(file);
      setChecked(null);
    },
    reach,
    setReach: (patch: Partial<ReachDraft>) => {
      setReachDraft((now) => ({ ...now, ...patch }));
      setChecked(null);
    },
    read,
    ready,
    principal,
    command: read.ok ? grantCommand(read.reach, principal) : null,
    checked,
    check: () => {
      const choices = body();
      if (choices) check.mutate(choices, { onSuccess: setChecked });
    },
    checking: check.isPending,
    checkError: check.error,
    connect: () => connect.mutate(),
    connecting: connect.isPending,
    connectError: connect.error,
  };
}

export type ConnectCloud = ReturnType<typeof useConnectCloud>;
