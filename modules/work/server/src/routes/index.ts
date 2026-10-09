import type { FastifyPluginAsync } from 'fastify';
import type { WorkControllers } from '../controllers/index.ts';
import { activityRoutes } from './activity.routes.ts';
import { boardsRoutes } from './boards.routes.ts';
import { fieldsRoutes } from './fields.routes.ts';
import { issuesRoutes } from './issues.routes.ts';
import { lqlRoutes } from './lql.routes.ts';
import { metricsRoutes } from './metrics.routes.ts';
import { projectsRoutes } from './projects.routes.ts';
import { typesRoutes } from './types.routes.ts';
import { workflowRoutes } from './workflow.routes.ts';

/**
 * Everything under /api/v1/work, one plugin per area so each area's routes
 * file stays its own and this list is the only shared line to add.
 */
export function workRoutes(controllers: WorkControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(projectsRoutes(controllers.projects));
    await app.register(typesRoutes(controllers.types));
    await app.register(fieldsRoutes(controllers.fields));
    await app.register(issuesRoutes(controllers.issues));
    await app.register(activityRoutes(controllers.activity));
    await app.register(workflowRoutes(controllers.workflow));
    await app.register(lqlRoutes(controllers.lql));
    await app.register(boardsRoutes(controllers.boards));
    await app.register(metricsRoutes(controllers.metrics));
  };
}
