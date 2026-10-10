import type {
  AcceptInvitationInput,
  CreateFirstAdminInput,
  LoginRequest,
  PasswordResetComplete,
} from '@bemmoly/shared';
import { audit, capabilitiesOf, currentUser, type MockDb } from '../db.ts';
import { makeUser, ROLE_IDS } from '../seed/people.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, invalid, ok, type MockRoute } from '../types.ts';
import { completedAtOf, workspaceLookOf } from '../workspace-look.ts';

function signIn(db: MockDb, userId: string, status = 200) {
  db.signedInAs = userId;
  const user = db.users.find((entry) => entry.id === userId);
  if (user) user.lastSeenAt = new Date().toISOString();
  return { status, body: { user } };
}

export function capture(db: MockDb, to: string, subject: string, text: string) {
  db.mailbox.unshift({
    id: newId(),
    to,
    from: 'Bemmoly <bemmoly@acmelabs.dev>',
    subject,
    html: null,
    text,
    headers: {},
    capturedAt: new Date().toISOString(),
  });
}

export const sessionRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/readyz',
    anonymous: true,
    handle: () => ok({ status: 'ready', checks: { database: { status: 'ok', latencyMs: 12 } } }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/setup/status',
    anonymous: true,
    handle: (_, db) =>
      ok({
        initialized: db.initialized,
        completedAt: completedAtOf(db),
        workspaceName: db.initialized ? workspaceLookOf(db).name : null,
      }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/setup/admin',
    anonymous: true,
    handle: (request, db) => {
      if (db.initialized) return fail(409, 'conflict', 'This workspace already has an admin.');
      const body = bodyOf<CreateFirstAdminInput>(request);
      if (!body.email || !body.password || !body.name || !body.workspaceName) {
        return invalid('email', 'Fill in every field.');
      }
      db.settings['workspace.name'] = body.workspaceName;
      db.settings['workspace.url'] = body.workspaceUrl;
      const user = {
        ...makeUser(newId(), body.name, body.email, ROLE_IDS.admin),
        isBreakGlass: true,
      };
      db.users.push(user);
      db.passwords[body.email] = body.password;
      db.initialized = true;
      audit(db, 'workspace.created', 'workspace', body.workspaceName);
      return signIn(db, user.id, 201);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/login',
    anonymous: true,
    handle: (request, db) => {
      const body = bodyOf<LoginRequest>(request);
      const user = db.users.find((entry) => entry.email === body.email?.toLowerCase());
      if (!user || db.passwords[user.email] !== body.password || user.status !== 'active') {
        return fail(401, 'unauthenticated', 'Email or password is incorrect');
      }
      return signIn(db, user.id);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/logout',
    handle: (_, db) => {
      db.signedInAs = null;
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/password-reset',
    anonymous: true,
    handle: (request, db) => {
      const email = bodyOf<{ email: string }>(request).email?.toLowerCase() ?? '';
      if (db.users.some((user) => user.email === email)) {
        const token = `reset-${newId().replaceAll('-', '')}`;
        db.resetTokens[token] = email;
        capture(
          db,
          email,
          'Reset your Bemmoly password',
          `Choose a new password: /reset-password#token=${token}`,
        );
      }
      return { status: 202 };
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/password-reset/complete',
    anonymous: true,
    handle: (request, db) => {
      const body = bodyOf<PasswordResetComplete>(request);
      const email = body.token ? db.resetTokens[body.token] : undefined;
      if (!email || !body.password)
        return fail(400, 'bad_request', 'This reset link has expired. Ask for a new one.');
      db.passwords[email] = body.password;
      delete db.resetTokens[body.token as string];
      return ok();
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/auth/invitations/:token',
    anonymous: true,
    handle: (request, db) => {
      const invitation = db.invitations.find(
        (entry) => entry.id === db.invitationTokens[request.params['token'] ?? ''],
      );
      if (!invitation)
        return fail(404, 'not_found', 'This invitation has expired or was already used.');
      return ok({
        email: invitation.email,
        workspaceName: String(db.settings['workspace.name'] ?? 'Bemmoly'),
        inviterName: db.users.find((user) => user.id === invitation.invitedBy)?.name ?? null,
        roleName: db.roles.find((role) => role.id === invitation.roleId)?.name ?? 'Member',
        teamName: db.teams.find((team) => team.id === invitation.teamId)?.name ?? null,
        expiresAt: invitation.expiresAt,
      });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/invitations/:token/accept',
    anonymous: true,
    handle: (request, db) => {
      const token = request.params['token'] ?? '';
      const invitation = db.invitations.find((entry) => entry.id === db.invitationTokens[token]);
      if (!invitation)
        return fail(404, 'not_found', 'This invitation has expired or was already used.');
      const body = bodyOf<AcceptInvitationInput>(request);
      let user = db.users.find((entry) => entry.email === invitation.email);
      if (!user) {
        user = makeUser(
          newId(),
          body.name ?? invitation.email,
          invitation.email,
          invitation.roleId,
        );
        db.users.push(user);
      }
      Object.assign(user, { name: body.name ?? user.name, status: 'active' });
      if (invitation.teamId && !user.teamIds.includes(invitation.teamId))
        user.teamIds.push(invitation.teamId);
      db.passwords[invitation.email] = body.password ?? '';
      invitation.acceptedAt = new Date().toISOString();
      delete db.invitationTokens[token];
      return signIn(db, user.id, 201);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/me',
    handle: (_, db) => {
      const user = currentUser(db);
      if (!user) return fail(401, 'unauthenticated', 'Sign in to continue.');
      return ok({
        user,
        capabilities: capabilitiesOf(db, user),
        modules: db.manifests.map((m) => m.id),
        workspace: workspaceLookOf(db),
      });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/sessions',
    handle: (_, db) =>
      ok({
        items: [
          {
            id: newId(),
            ip: '127.0.0.1',
            userAgent: 'This browser',
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            current: Boolean(db.signedInAs),
          },
        ],
      }),
  },
  { method: 'GET', pattern: '/api/v1/modules', handle: (_, db) => ok({ items: db.manifests }) },
];
