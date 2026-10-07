import type { FastifyPluginAsync } from 'fastify';
import type { IdentityController } from '../controllers/identity.controller.ts';
import type { PeopleController } from '../controllers/people.controller.ts';

/** Routes that must work before anyone is signed in. Rate limited strictly per IP. */
const ANONYMOUS = { config: { anonymous: true } } as const;

export function identityRoutes(
  identity: IdentityController,
  people: PeopleController,
): FastifyPluginAsync {
  return async (app) => {
    // Anonymous by design: the setup wizard runs before any account exists.
    app.get('/setup/status', ANONYMOUS, async () => identity.setupStatus());
    app.post('/setup/admin', ANONYMOUS, async (req, reply) =>
      identity.createFirstAdmin(req, reply),
    );

    // Anonymous by design: sign-in, password reset and invitation accept.
    app.post('/auth/login', ANONYMOUS, async (req, reply) => identity.login(req, reply));
    app.post('/auth/password-reset', ANONYMOUS, async (req, reply) =>
      identity.requestPasswordReset(req, reply),
    );
    app.post('/auth/password-reset/complete', ANONYMOUS, async (req, reply) =>
      identity.completePasswordReset(req, reply),
    );
    app.get('/auth/invitations/:token', ANONYMOUS, async (req) => identity.previewInvitation(req));
    app.post('/auth/invitations/:token/accept', ANONYMOUS, async (req, reply) =>
      identity.acceptInvitation(req, reply),
    );
    app.post('/auth/logout', async (req, reply) => identity.logout(req, reply));

    app.get('/me', async (req) => identity.me(req));
    app.get('/sessions', async (req) => identity.listSessions(req));
    app.delete('/sessions/:id', async (req, reply) => identity.revokeSession(req, reply));
    app.get('/api-tokens', async (req) => identity.listApiTokens(req));
    app.post('/api-tokens', async (req, reply) => identity.createApiToken(req, reply));
    app.delete('/api-tokens/:id', async (req, reply) => identity.revokeApiToken(req, reply));

    app.get('/users', async (req) => people.listUsers(req));
    app.get('/users/:id', async (req) => people.getUser(req));
    app.patch('/users/:id', async (req) => people.updateUser(req));
    app.post('/users/:id/deactivate', async (req) => people.deactivateUser(req));
    app.post('/users/:id/reactivate', async (req) => people.reactivateUser(req));

    app.get('/invitations', async (req) => people.listInvitations(req));
    app.post('/invitations', async (req, reply) => people.createInvitations(req, reply));
    app.delete('/invitations/:id', async (req, reply) => people.revokeInvitation(req, reply));

    app.get('/teams', async (req) => people.listTeams(req));
    app.post('/teams', async (req, reply) => people.createTeam(req, reply));
    app.get('/teams/:id', async (req) => people.getTeam(req));
    app.patch('/teams/:id', async (req) => people.updateTeam(req));
    app.delete('/teams/:id', async (req, reply) => people.deleteTeam(req, reply));
    app.get('/teams/:id/members', async (req) => people.listTeamMembers(req));
    app.put('/teams/:id/members/:userId', async (req) => people.addTeamMember(req));
    app.delete('/teams/:id/members/:userId', async (req, reply) =>
      people.removeTeamMember(req, reply),
    );
  };
}
