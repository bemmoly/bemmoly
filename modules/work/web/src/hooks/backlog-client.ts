import { workBacklogEndpoints, workSprintEndpoints } from '../api/index.ts';
import { api } from '../shared/index.ts';

/**
 * The Backlog's calls on the chunk's one client: the shared Work client
 * carries the reads every screen makes, these the Backlog's own writes.
 */
export const planning = {
  ...workBacklogEndpoints(api.http).backlog,
  ...workSprintEndpoints(api.http).sprintPlanning,
};

export type Planning = typeof planning;
