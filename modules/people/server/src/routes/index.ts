import type { FastifyPluginAsync } from 'fastify';
import type { PeopleControllers } from '../controllers/index.ts';

/**
 * Everything under /api/v1/hr. The person record itself is the kernel's /api/v1/people;
 * these are the People product's own resources around it.
 */
export function peopleRoutes(c: PeopleControllers): FastifyPluginAsync {
  return async (app) => {
    app.get('/directory', async (request) => c.directory.list(request));
    app.get('/profiles/:userId', async (request) => c.directory.profile(request));
    app.put('/profiles/:userId/fields', async (request) => c.directory.updateFields(request));
    app.get('/profile-fields', async (request) => c.directory.fieldDefinitions(request));
    app.post('/profile-fields', async (request, reply) => c.directory.createField(request, reply));

    app.get('/levels', async () => c.levels.list());
    app.post('/levels', async (request, reply) => c.levels.create(request, reply));
    app.patch('/levels/:id', async (request) => c.levels.update(request));
    app.delete('/levels/:id', async (request, reply) => c.levels.remove(request, reply));

    app.get('/leave-policies', async (request) => c.leave.listPolicies(request));
    app.post('/leave-policies', async (request, reply) => c.leave.createPolicy(request, reply));
    app.patch('/leave-policies/:id', async (request) => c.leave.updatePolicy(request));
    app.get('/leave-requests', async (request) => c.leave.listRequests(request));
    app.post('/leave-requests', async (request, reply) => c.leave.createRequest(request, reply));
    app.post('/leave-requests/:id/withdraw', async (request) => c.leave.withdrawRequest(request));
    app.get('/leave-balances', async (request) => c.leave.balances(request));
    app.get('/absences', async (request) => c.leave.absences(request));

    app.get('/journey-templates', async () => c.journeys.listTemplates());
    app.post('/journey-templates', async (request, reply) =>
      c.journeys.createTemplate(request, reply),
    );
    app.patch('/journey-templates/:id', async (request) => c.journeys.updateTemplate(request));
    app.get('/journeys', async (request) => c.journeys.list(request));
    app.post('/journeys', async (request, reply) => c.journeys.start(request, reply));
    app.get('/journeys/:id', async (request) => c.journeys.get(request));
    app.get('/journey-tasks', async (request) => c.journeys.myTasks(request));
    app.patch('/journey-tasks/:id', async (request) => c.journeys.updateTask(request));
  };
}
