import { queryKeys } from '@bemmoly/api-client';
import type {
  CodeHost,
  CodeHostTestResult,
  CreateCodeHostInput,
  StartGithubAppInput,
  UpdateCodeHostInput,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import type { PillTone } from '../components/settings/state-pill.tsx';
import { codeHostsApi } from '../lib/code-hosts-api.ts';

export const CODE_HOSTS_CAPABILITY = 'workspace.settings.manage';

export const HOST_LABELS: Record<CodeHost['kind'], string> = { github: 'GitHub', gitlab: 'GitLab' };

/** A GitHub App Bemmoly created that has not been installed on any repositories yet. */
export const awaitingInstall = (host: CodeHost) =>
  host.installUrl !== null && host.installationId === null;

/** A host's state in words for its card: off, refusing, waiting for a first delivery, or fine. */
export function hostState(host: CodeHost): { tone: PillTone; label: string } {
  if (!host.enabled) return { tone: 'neutral', label: 'Off' };
  if (awaitingInstall(host)) return { tone: 'warn', label: 'Not installed' };
  if (host.lastError) return { tone: 'red', label: 'Needs attention' };
  if (!host.lastDelivery) return { tone: 'warn', label: 'No deliveries yet' };
  return { tone: 'ok', label: 'Receiving' };
}

/** Connected code hosts: list, connect, edit, remove, test delivery and backfill. */
export function useCodeHosts(enabled = true) {
  const client = useQueryClient();
  const [tests, setTests] = useState<Record<string, CodeHostTestResult>>({});
  const query = useQuery({
    queryKey: queryKeys.codeHosts.list(),
    queryFn: () => codeHostsApi.list(),
    enabled,
  });
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.codeHosts.all() });
  const create = useMutation({
    mutationFn: (input: CreateCodeHostInput) => codeHostsApi.create(input),
    onSuccess: async (host) => {
      toast(`${host.name} connected`);
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCodeHostInput }) =>
      codeHostsApi.update(id, input),
    onSuccess: async (host) => {
      toast(`${host.name} saved`);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => codeHostsApi.remove(id),
    onSuccess: async () => {
      toast('Code host removed');
      await refresh();
    },
  });
  const test = useMutation({
    mutationFn: (id: string) => codeHostsApi.test(id),
    onSuccess: async (result, id) => {
      setTests((previous) => ({ ...previous, [id]: result }));
      await refresh();
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  const startGithubApp = useMutation({
    mutationFn: (input: StartGithubAppInput) => codeHostsApi.startGithubApp(input),
  });
  const backfill = useMutation({
    mutationFn: (id: string) => codeHostsApi.backfill(id),
    onSuccess: (result) =>
      toast(
        result.queued
          ? `Backfill started for ${result.repositories} ${result.repositories === 1 ? 'repository' : 'repositories'}`
          : 'A backfill is already waiting to run',
      ),
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  return {
    query,
    items: query.data ?? [],
    create: (input: CreateCodeHostInput) => create.mutateAsync(input),
    creating: create.isPending,
    update: (id: string, input: UpdateCodeHostInput) => update.mutateAsync({ id, input }),
    updating: update.isPending,
    remove: (id: string) => remove.mutateAsync(id),
    test: (id: string) => test.mutate(id),
    testing: test.isPending ? (test.variables ?? null) : null,
    lastTest: (id: string): CodeHostTestResult | undefined => tests[id],
    /** The manifest to post to GitHub; the rest of the trip is useGithubAppReturn. */
    startGithubApp: (input: StartGithubAppInput) => startGithubApp.mutateAsync(input),
    startingGithubApp: startGithubApp.isPending,
    backfill: (id: string) => backfill.mutate(id),
    backfilling: backfill.isPending ? (backfill.variables ?? null) : null,
  };
}

export type CodeHosts = ReturnType<typeof useCodeHosts>;

/** The last twenty deliveries of one host, for its log. */
export function useCodeHostDeliveries(id: string | null) {
  return useQuery({
    queryKey: queryKeys.codeHosts.deliveries(id ?? ''),
    queryFn: () => codeHostsApi.deliveries(id ?? ''),
    enabled: Boolean(id),
  });
}
