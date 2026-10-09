import type { Project, Workflow } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { projectsQuery } from '../shared/index.ts';
import { workflowsQuery } from './workflow-queries.ts';

/**
 * Which projects run each workflow. A project's own workflow serves that
 * project; the org default serves every project without one of its own,
 * which is how the server picks a project's workflow.
 */
export function projectsUsing(workflow: Workflow, all: Workflow[], projects: Project[]) {
  if (workflow.projectId) return projects.filter((project) => project.id === workflow.projectId);
  const own = new Set(all.flatMap((candidate) => candidate.projectId ?? []));
  return projects.filter((project) => !own.has(project.id));
}

export interface WorkflowUsage {
  workflows: Workflow[];
  projects: Project[];
  usage: (workflow: Workflow) => Project[];
  isPending: boolean;
  error: unknown;
}

/** Every workflow with the projects using it, for the list and the publish confirmation. */
export function useWorkflowUsage(): WorkflowUsage {
  const workflows = useQuery(workflowsQuery());
  const projects = useQuery(projectsQuery);
  return useMemo(() => {
    const all = workflows.data ?? [];
    const list = projects.data?.items ?? [];
    return {
      workflows: all,
      projects: list,
      usage: (workflow: Workflow) => projectsUsing(workflow, all, list),
      isPending: workflows.isPending || projects.isPending,
      error: workflows.error ?? projects.error,
    };
  }, [
    workflows.data,
    workflows.isPending,
    workflows.error,
    projects.data,
    projects.isPending,
    projects.error,
  ]);
}
