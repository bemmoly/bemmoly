import type { WorkAction } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { workMembersKeys } from '../api/index.ts';
import { api } from '../shared/index.ts';

export interface ProjectActions {
  /** Whether the signed-in person may take the action in this project. */
  can(action: WorkAction): boolean;
}

/**
 * What the signed-in person may do in one project, after their project role, so a control
 * the server would refuse is hidden or disabled instead of failing on click. Until the answer
 * arrives, and when it cannot be read, every action reads as allowed: the server decides on
 * every write and a refusal is shown where it happened.
 */
export function useProjectActions(projectKey: string | undefined): ProjectActions {
  const query = useQuery({
    queryKey: workMembersKeys.permissions(projectKey ?? ''),
    queryFn: () => api.work.members.permissions(projectKey ?? ''),
    enabled: Boolean(projectKey),
    staleTime: 60_000,
  });
  const held = query.data ? new Set(query.data.actions) : null;
  return { can: (action) => held === null || held.has(action) };
}
