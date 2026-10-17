import { queryKeys } from '@bemmoly/api-client';
import type {
  CreateImportBody,
  ImportJob,
  ImportJobStatus,
  UpdateImportBody,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importsApi } from '../lib/imports-api.ts';

/** How often a queued or running job is read again. */
export const IMPORT_POLL_MS = 1000;

const ACTIVE: readonly ImportJobStatus[] = ['queued', 'running'];
export const isActive = (status: ImportJobStatus | undefined) =>
  status !== undefined && ACTIVE.includes(status);

/** The sources the enabled modules offer; empty when none is enabled. */
export function useImportSources(enabled = true) {
  return useQuery({
    queryKey: queryKeys.imports.sources(),
    queryFn: () => importsApi.sources(),
    enabled,
    retry: false,
  });
}

/**
 * The latest imports, newest first, to reopen one. The open job is polled on its own, so its
 * fresher copy stands in for the listed one and the two never disagree.
 */
export function useImportJobs(open?: ImportJob) {
  const query = useQuery({
    queryKey: queryKeys.imports.list(),
    queryFn: () => importsApi.list(),
  });
  const items = (query.data?.items ?? []).map((job) => (job.id === open?.id ? open : job));
  return { ...query, items };
}

/** One job, read every second while it is queued or running. */
export function useImportJob(id: string | null) {
  return useQuery({
    queryKey: queryKeys.imports.detail(id ?? ''),
    queryFn: () => importsApi.get(id ?? ''),
    enabled: id !== null,
    refetchInterval: (query) => (isActive(query.state.data?.status) ? IMPORT_POLL_MS : false),
  });
}

/** Connect, plan, run and cancel: each answers with the job, which replaces the cached one. */
export function useImportActions(onCreated: (job: ImportJob) => void) {
  const client = useQueryClient();
  const store = (job: ImportJob) => {
    client.setQueryData(queryKeys.imports.detail(job.id), job);
    void client.invalidateQueries({ queryKey: queryKeys.imports.list() });
  };
  const create = useMutation({
    mutationFn: (body: CreateImportBody) => importsApi.create(body),
    onSuccess: (job) => {
      store(job);
      onCreated(job);
    },
  });
  const plan = useMutation({
    /** Without containers it plans what is ticked in the server's selection. */
    mutationFn: ({ id, body = {} }: { id: string; body?: UpdateImportBody }) =>
      importsApi.update(id, body),
    onSuccess: store,
  });
  /** Everything planned, or with `containers` only those again (Retry), from their checkpoints. */
  const run = useMutation({
    mutationFn: ({ id, containers }: { id: string; containers?: string[] }) =>
      importsApi.run(id, containers ? { containers } : {}),
    onSuccess: store,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => importsApi.cancel(id),
    onSuccess: store,
  });
  return { create, plan, run, cancel };
}
