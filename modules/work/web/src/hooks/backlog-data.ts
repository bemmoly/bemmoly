import { queryKeys } from '@bemmoly/api-client';
import type { Backlog, Project } from '@bemmoly/module-work/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { backlogKeys } from '../api/index.ts';
import {
  containersOf,
  epicLooks,
  personLooks,
  statusLooks,
  typeLooks,
  type Container,
  type Lookups,
} from '../backlog/model.ts';
import { api, useProject, workKeys } from '../shared/index.ts';
import { planning } from './backlog-client.ts';

export const backlogQuery = (projectKey: string) =>
  queryOptions({
    queryKey: backlogKeys.backlog(projectKey),
    queryFn: () => planning.get(projectKey),
  });

const USERS = { limit: 100 } as const;

export interface BacklogData {
  project: Project | undefined;
  projectKey: string | null;
  backlog: Backlog | undefined;
  containers: Container[];
  lookups: Lookups;
  /** The board's sprint length, the default span of a sprint being started. */
  cadenceDays: number;
  /** The issue type inline create uses: Story when the project has it. */
  defaultTypeId: string | undefined;
  /** The epic type, for "+ Create" in the epics panel. */
  epicTypeId: string | undefined;
  standardTypes: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  isPending: boolean;
  error: Error | null;
}

/**
 * The Backlog read and the vocabularies its rows are painted with: the
 * workflow's statuses under the board's column names, issue types, people
 * and the epic panel's colours. Each vocabulary shares its query key with
 * the screen that owns it, so the cache serves both.
 */
export function useBacklogData(pathKey: string | undefined): BacklogData {
  const { project, projectKey, isPending: projectPending } = useProject(pathKey);
  const key = project?.key ?? '';
  const projectId = project?.id ?? '';
  const enabled = Boolean(project);

  const backlog = useQuery({ ...backlogQuery(key), enabled });
  const workflows = useQuery({
    queryKey: workKeys.workflows(projectId),
    queryFn: () => api.work.workflows.list(projectId),
    enabled,
  });
  const types = useQuery({
    queryKey: workKeys.issueTypes(projectId),
    queryFn: () => api.work.issueTypes.list(projectId),
    enabled,
  });
  const boards = useQuery({
    queryKey: workKeys.boards(projectId),
    queryFn: () => api.work.boards.list(projectId),
    enabled,
  });
  const me = useQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me(), retry: false });
  const users = useQuery({
    queryKey: queryKeys.users.list(USERS),
    queryFn: () => api.users.list(USERS),
    retry: false,
  });

  const board = boards.data?.[0];
  const lookups = useMemo<Lookups>(() => {
    const statuses = workflows.data?.flatMap((workflow) => workflow.statuses) ?? [];
    return {
      statuses: statusLooks(statuses, board?.config ?? null),
      types: typeLooks(types.data ?? []),
      people: personLooks(users.data?.items ?? [], me.data?.user.id),
      epics: epicLooks(backlog.data?.epics ?? []),
    };
  }, [workflows.data, board, types.data, users.data, me.data, backlog.data?.epics]);

  const containers = useMemo(
    () => (backlog.data ? containersOf(backlog.data) : []),
    [backlog.data],
  );
  const standardTypes = (types.data ?? []).filter((type) => type.level === 'standard');

  return {
    project,
    projectKey,
    backlog: backlog.data,
    containers,
    lookups,
    cadenceDays: board?.config.cadenceDays ?? 14,
    defaultTypeId: (standardTypes.find((type) => type.key === 'story') ?? standardTypes[0])?.id,
    epicTypeId: types.data?.find((type) => type.level === 'epic')?.id,
    standardTypes: standardTypes.map((type) => ({ id: type.id, name: type.name })),
    people: (users.data?.items ?? []).map((user) => ({ id: user.id, name: user.name })),
    isPending: projectPending || (enabled && backlog.isPending),
    error: backlog.error,
  };
}
