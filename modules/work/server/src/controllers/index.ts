import type { WorkServices } from '../services/index.ts';
import { createProjectsController } from './projects.controller.ts';
import { createWorkflowController } from './workflow.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createWorkControllers(services: WorkServices) {
  return {
    projects: createProjectsController(services.projects),
    workflow: createWorkflowController(services.workflow),
  };
}

export type WorkControllers = ReturnType<typeof createWorkControllers>;
