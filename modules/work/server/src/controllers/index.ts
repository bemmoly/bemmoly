import type { WorkServices } from '../services/index.ts';
import { createActivityController } from './activity.controller.ts';
import { createFieldsController } from './fields.controller.ts';
import { createIssuesController } from './issues.controller.ts';
import { createProjectsController } from './projects.controller.ts';
import { createTypesController } from './types.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createWorkControllers(services: WorkServices) {
  return {
    projects: createProjectsController(services.projects),
    types: createTypesController(services.types),
    fields: createFieldsController(services.fields),
    issues: createIssuesController(services.issues),
    activity: createActivityController(services),
  };
}

export type WorkControllers = ReturnType<typeof createWorkControllers>;
