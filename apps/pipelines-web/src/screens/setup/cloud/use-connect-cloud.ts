import type {
  CloudAccessCheckBody,
  CloudAccessCheckResponse,
  ConnectCloudBody,
} from '@bemmoly/module-pipelines/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api.ts';
import { useAccessCheck, useReturnToChecklist } from '../../../hooks/use-setup.ts';
import { checkReport } from './guide-report.ts';
import { fieldValid } from './guide-values.ts';
import { useGuide, type Guide } from './use-guide.ts';

export type { GuideSignIn as SignInChoice } from './guide-steps.ts';

interface Messages {
  connected: string;
  connectedManaged: string;
  name: string;
}

function checkBody(guide: Guide): CloudAccessCheckBody | null {
  const { signIn, credentialFile, values, read, mode } = guide;
  if (!signIn || (signIn === 'workload_identity_file' && !credentialFile)) return null;
  const base = { provider: 'gcp' as const, signIn, ...(credentialFile ? { credentialFile } : {}) };
  if (mode === 'managed') {
    const ok =
      fieldValid('folderId', values.folderId) &&
      fieldValid('billingAccountId', values.billingAccountId);
    return ok
      ? {
          ...base,
          managed: { folderId: values.folderId, billingAccountId: values.billingAccountId },
        }
      : null;
  }
  return read.ok ? { ...base, reach: read.reach } : null;
}

function connectBody(guide: Guide, name: string): ConnectCloudBody | null {
  const check = checkBody(guide);
  if (!check) return null;
  const { values } = guide;
  if (guide.mode === 'attached') {
    return { ...check, provider: 'gcp', name, mode: 'attached' };
  }
  return {
    provider: 'gcp',
    name,
    mode: 'managed',
    layout: 'starter',
    signIn: check.signIn,
    ...(check.credentialFile ? { credentialFile: check.credentialFile } : {}),
    folderId: values.folderId,
    billingAccountId: values.billingAccountId,
    controlProject: values.controlProject,
    region: values.region,
  };
}

/**
 * Connect a cloud: the guided steps for the person's choices, Check (which reports per step
 * what is done and what is missing), and Connect. A changed choice clears the last check, so
 * what is connected is always what was checked. A managed connection is checked again once
 * stored; it counts as connected only when its folder and billing grants hold.
 */
export function useConnectCloud(messages: Messages) {
  const [checked, setChecked] = useState<CloudAccessCheckResponse | null>(null);
  const [storedId, setStoredId] = useState<string | null>(null);
  const [stillMissing, setStillMissing] = useState<string[]>([]);
  const guide = useGuide(() => {
    setChecked(null);
    setStillMissing([]);
  });
  const check = useAccessCheck();
  const back = useReturnToChecklist();
  const body = checkBody(guide);
  const report = checked
    ? checkReport({
        steps: guide.steps,
        response: checked,
        expected: guide.expected,
        folderId: guide.values.folderId,
      })
    : null;
  const connect = useMutation({
    mutationFn: async () => {
      const choices = connectBody(guide, messages.name);
      if (!choices) throw new Error('Finish the steps and check access first');
      if (guide.mode === 'attached') {
        await api.platform.connect(choices);
        return { connected: true, problems: [] as string[] };
      }
      // Stored once: trying again checks the same connection instead of making another.
      const id = storedId ?? (await api.platform.connect(choices)).id;
      setStoredId(id);
      const stored = await api.platform.checkConnection(id);
      return { connected: stored.status === 'connected', problems: stored.problems };
    },
    onSuccess: (result) => {
      if (result.connected) {
        void back(guide.mode === 'managed' ? messages.connectedManaged : messages.connected);
      } else setStillMissing(result.problems);
    },
  });
  return {
    guide,
    canCheck: body !== null,
    checked,
    report,
    check: () => {
      if (body) check.mutate(body, { onSuccess: setChecked });
    },
    checking: check.isPending,
    checkError: check.error,
    connect: () => connect.mutate(),
    connecting: connect.isPending,
    connectError: connect.error,
    stillMissing,
  };
}

export type ConnectCloud = ReturnType<typeof useConnectCloud>;
