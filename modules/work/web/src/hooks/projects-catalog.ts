import type { WorkflowStatus } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { issueKeys } from './issue-keys.ts';

const CATALOG_STALE = 5 * 60_000;
const catalog = api.work.projectCatalog;

/** The issue types a project offers, first to last, with a lookup by id. */
export function useIssueTypes(projectKey: string | undefined) {
  const query = useQuery({
    queryKey: issueKeys.catalog(projectKey ?? '', 'issue-types'),
    queryFn: () => catalog.issueTypes(projectKey ?? ''),
    enabled: Boolean(projectKey),
    staleTime: CATALOG_STALE,
  });
  const types = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.position - b.position),
    [query.data],
  );
  const byId = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  return { types, byId, isPending: query.isPending, error: query.error };
}

export function useFields(projectKey: string | undefined) {
  return useQuery({
    queryKey: issueKeys.catalog(projectKey ?? '', 'fields'),
    queryFn: () => catalog.fields(projectKey ?? ''),
    enabled: Boolean(projectKey),
    staleTime: CATALOG_STALE,
  });
}

/** The create form layout of one type: its fields in order with the required flag. */
export function useTypeLayout(projectKey: string | undefined, typeId: string | undefined) {
  return useQuery({
    queryKey: issueKeys.layout(projectKey ?? '', typeId ?? ''),
    queryFn: () => catalog.layout(projectKey ?? '', typeId ?? ''),
    enabled: Boolean(projectKey && typeId),
    staleTime: CATALOG_STALE,
  });
}

/**
 * Every status of the project's workflow by id, so rows that carry only a status id can
 * paint their badge. The project's own copy wins over the org default.
 */
export function useStatuses(projectId: string | undefined) {
  const query = useQuery({
    queryKey: issueKeys.statuses(projectId ?? ''),
    queryFn: () => catalog.workflows(projectId ?? ''),
    enabled: Boolean(projectId),
    staleTime: CATALOG_STALE,
  });
  return useMemo(() => {
    const map = new Map<string, WorkflowStatus>();
    const workflows = query.data ?? [];
    const ordered = [
      ...workflows.filter((flow) => flow.projectId === null),
      ...workflows.filter((flow) => flow.projectId !== null),
    ];
    for (const flow of ordered) for (const status of flow.statuses) map.set(status.id, status);
    return map;
  }, [query.data]);
}

function useProjectList<T>(projectKey: string | undefined, part: string, load: () => Promise<T>) {
  return useQuery({
    queryKey: issueKeys.catalog(projectKey ?? '', part),
    queryFn: load,
    enabled: Boolean(projectKey),
    staleTime: CATALOG_STALE,
    retry: false,
  });
}

export const useLabels = (projectKey: string | undefined) =>
  useProjectList(projectKey, 'labels', () => catalog.labels(projectKey ?? ''));

export const useVersions = (projectKey: string | undefined) =>
  useProjectList(projectKey, 'versions', () => catalog.versions(projectKey ?? ''));

export const useSprints = (projectKey: string | undefined) =>
  useProjectList(projectKey, 'sprints', () => catalog.sprints(projectKey ?? ''));
