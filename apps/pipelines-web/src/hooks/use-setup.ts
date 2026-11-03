import type { CloudAccessCheckBody, StartOverBody } from '@bemmoly/module-pipelines/shared';
import { useToast } from '@bemmoly/ui';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { setupKeys } from '../api/setup.ts';
import { api } from '../lib/api.ts';

/*
 * The fresh-install checklist (product rule 2). Each setup step, whichever screen it was done
 * on, ends with `useReturnToChecklist()`: while the checklist is not done, the person goes back
 * to it, with a note of what just happened, so they can pick the next step.
 */

export const checklistQuery = queryOptions({
  queryKey: setupKeys.checklist(),
  queryFn: () => api.setup.checklist(),
});

export function useChecklist() {
  return useQuery(checklistQuery);
}

/**
 * Call after a setup step succeeds. It refreshes the checklist and, if setup was still under
 * way, goes back to it on For you with `message` as a toast. Answers whether it went back.
 */
export function useReturnToChecklist() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  return useCallback(
    async (message?: string) => {
      const before = client.getQueryData(checklistQuery.queryKey);
      await client.invalidateQueries({ queryKey: setupKeys.all });
      const settingUp = before ? !before.complete : true;
      if (message) toast.show({ tone: 'ok', title: message });
      if (!settingUp) return false;
      await navigate({ to: '/' });
      return true;
    },
    [client, navigate, toast],
  );
}

/** Who Bemmoly signs in as with a sign-in method, before any project is chosen. */
export function useWhoAmI(signIn: CloudAccessCheckBody['signIn'] | null) {
  return useQuery({
    queryKey: setupKeys.whoAmI(signIn ?? 'none'),
    queryFn: () => api.setup.accessCheck({ provider: 'gcp', signIn: signIn ?? 'vm' }),
    enabled: signIn === 'vm' || signIn === 'application_default',
    staleTime: 5 * 60_000,
  });
}

export function useAccessCheck() {
  return useMutation({ mutationFn: (body: CloudAccessCheckBody) => api.setup.accessCheck(body) });
}

/** Start over: everything Pipelines recorded goes, and every cached read with it. */
export function useStartOver() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: StartOverBody) => api.setup.startOver(body),
    onSuccess: () => client.invalidateQueries(),
  });
}
