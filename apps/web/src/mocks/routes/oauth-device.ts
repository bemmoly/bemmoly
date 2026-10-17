import { decideOAuthDeviceSchema, deviceUserCodeSchema } from '@bemmoly/shared';
import { audit, type MockDb } from '../db.ts';
import { fail, ok, type MockRoute } from '../types.ts';

/*
 * The /device page's two calls. The mock knows one pending sign-in, from bp, under the code
 * WDJB-MJHT; deciding it once uses it up, as the server does.
 */

export const MOCK_DEVICE_CODE = 'WDJB-MJHT';

const decided = new WeakMap<MockDb, Set<string>>();
const usedOf = (db: MockDb) => {
  let used = decided.get(db);
  if (!used) decided.set(db, (used = new Set()));
  return used;
};

const pending = (db: MockDb, text: string | null) => {
  const code = deviceUserCodeSchema.safeParse(text ?? '');
  return code.success && code.data === MOCK_DEVICE_CODE && !usedOf(db).has(code.data)
    ? code.data
    : null;
};

const EXPIRED = 'That code is not valid or has expired. Start signing in again on your device.';

export const oauthDeviceRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/oauth/device-requests',
    handle: (request, db) => {
      const code = pending(db, request.query.get('userCode'));
      if (!code) return fail(404, 'not_found', EXPIRED);
      return ok({
        userCode: code,
        clientName: 'bp, the Pipelines command line',
        deviceName: 'bp on build-box',
        modules: ['pipelines'],
        access: 'write',
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/oauth/device-decisions',
    handle: (request, db) => {
      const input = decideOAuthDeviceSchema.parse(request.body);
      const code = pending(db, input.userCode);
      if (!code) return fail(404, 'not_found', EXPIRED);
      usedOf(db).add(code);
      audit(
        db,
        input.approve ? 'oauth.device_approved' : 'oauth.device_denied',
        'oauth_device',
        code,
      );
      return ok({ status: input.approve ? 'approved' : 'denied' }, 201);
    },
  },
];
