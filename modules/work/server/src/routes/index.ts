import type { FastifyPluginAsync } from 'fastify';
import type { WorkControllers } from '../controllers/index.ts';
import { activityRoutes } from './activity.routes.ts';
import { backlogRoutes } from './backlog.routes.ts';
import { boardsRoutes } from './boards.routes.ts';
import { componentsRoutes } from './components.routes.ts';
import { fieldsRoutes } from './fields.routes.ts';
import { filtersRoutes } from './filters.routes.ts';
import { issuesRoutes } from './issues.routes.ts';
import { labelsRoutes } from './labels.routes.ts';
import { lqlRoutes } from './lql.routes.ts';
import { membersRoutes } from './members.routes.ts';
import { metricsRoutes } from './metrics.routes.ts';
import { myWorkRoutes } from './my-work.routes.ts';
import { projectsRoutes } from './projects.routes.ts';
import { schemesRoutes } from './schemes.routes.ts';
import { sprintsRoutes } from './sprints.routes.ts';
import { typesRoutes } from './types.routes.ts';
import { versionsRoutes } from './versions.routes.ts';
import { workflowRoutes } from './workflow.routes.ts';

/**
 * Everything under /api/v1/work, one plugin per area so each area's routes
 * file stays its own and this list is the only shared line to add.
 */
export function workRoutes(controllers: WorkControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(projectsRoutes(controllers.projects));
    await app.register(membersRoutes(controllers.members));
    await app.register(schemesRoutes(controllers.schemes));
    await app.register(typesRoutes(controllers.types));
    await app.register(fieldsRoutes(controllers.fields));
    await app.register(labelsRoutes(controllers.labels));
    await app.register(versionsRoutes(controllers.versions));
    await app.register(componentsRoutes(controllers.components));
    await app.register(issuesRoutes(controllers.issues));
    await app.register(activityRoutes(controllers.activity));
    await app.register(workflowRoutes(controllers.workflow));
    await app.register(lqlRoutes(controllers.lql));
    await app.register(boardsRoutes(controllers.boards));
    await app.register(sprintsRoutes(controllers.sprints));
    await app.register(backlogRoutes(controllers.backlog));
    await app.register(filtersRoutes(controllers.filters));
    await app.register(metricsRoutes(controllers.metrics));
    await app.register(myWorkRoutes(controllers.myWork));
  };
}
