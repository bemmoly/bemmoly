import type { AskReportResponse, ReportSpec } from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, workKeys } from '../shared/index.ts';

/*
 * Asking for a report and keeping the ones worth keeping. The answer to a question lives in
 * the mutation (it is not server state anyone else reads); pins are a query, rebuilt by the
 * server on every read so they are always current.
 */

export function useAskReport(projectKey: string) {
  const [notUseful, setNotUseful] = useState(false);
  const ask = useMutation({
    mutationFn: (question: string) => api.work.askReports.ask(projectKey, question),
    onMutate: () => setNotUseful(false),
  });
  const rateNotUseful = (answer: AskReportResponse) => {
    setNotUseful(true);
    api.ai.runs.feedback(answer.runId, 'not_useful').catch(() => setNotUseful(false));
  };
  return { ask, notUseful, rateNotUseful };
}

export function usePinnedReports(projectKey: string) {
  const client = useQueryClient();
  const key = workKeys.pinnedReports(projectKey);
  const pins = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.work.pinnedReports.list(projectKey, { signal }),
    enabled: Boolean(projectKey),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const pin = useMutation({
    mutationFn: (body: { question: string; spec: ReportSpec }) =>
      api.work.pinnedReports.pin(projectKey, body),
    onSuccess: refresh,
  });
  const unpin = useMutation({
    mutationFn: (id: string) => api.work.pinnedReports.unpin(id),
    onSuccess: refresh,
  });
  return { pins, pin, unpin };
}
