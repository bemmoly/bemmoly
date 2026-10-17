import { randomInt } from 'node:crypto';
import {
  DEVICE_USER_CODE_ALPHABET,
  NotFoundError,
  type DecideOAuthDeviceInput,
  type OAuthDeviceAuthorizationRequest,
  type OAuthDeviceAuthorizationResponse,
  type OAuthDeviceDecision,
  type OAuthDeviceRequest,
} from '@bemmoly/shared';
import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { oauthDeviceCodes, users } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { appLink, digestToken, generateToken, issueApiToken } from '../identity/index.ts';
import { nowOf, type OAuthDependencies } from './deps.ts';
import { invalidGrant, OAuthProtocolError } from './errors.ts';
import { sessionUserId } from './request.ts';
import { DEVICE_VERIFICATION_PATH } from './urls.ts';

/*
 * Device sign-in (RFC 8628) for Bemmoly's own command line tools (ADR 0046). The tool asks
 * for a code; the person approves it on /device in a browser where they are signed in; the
 * tool polls the token endpoint and collects an API token limited to its product's module.
 * The token is minted when it is collected, for the person who approved, so only an approval
 * from a session can ever lead to one, and the raw token is never stored.
 */

interface DeviceClient {
  name: string;
  modules: readonly string[];
}

/** First-party tools only: a third-party client signs in through the consent screen. */
const DEVICE_CLIENTS: Readonly<Record<string, DeviceClient>> = {
  'bemmoly-pipelines-cli': { name: 'bp, the Pipelines command line', modules: ['pipelines'] },
};

export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
export const DEVICE_POLL_SECONDS = 5;
/** A command line sign-in lasts a quarter; then the person signs in again. */
export const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEVICE_CODE_PREFIX = 'bmo_dc_';

function clientOf(deps: OAuthDependencies, clientId: string): DeviceClient {
  const client = DEVICE_CLIENTS[clientId];
  if (!client) {
    throw new OAuthProtocolError('invalid_client', 'This client may not use device sign-in', 401);
  }
  const missing = client.modules.find((id) => !deps.isEnabled(id));
  if (missing) {
    throw new OAuthProtocolError('invalid_request', `The ${missing} module is not enabled here`);
  }
  return client;
}

function userCode(): string {
  const letters = Array.from(
    { length: 8 },
    () => DEVICE_USER_CODE_ALPHABET[randomInt(DEVICE_USER_CODE_ALPHABET.length)],
  ).join('');
  return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}

export async function startDeviceAuthorization(
  deps: OAuthDependencies,
  input: OAuthDeviceAuthorizationRequest,
): Promise<OAuthDeviceAuthorizationResponse> {
  const client = clientOf(deps, input.client_id);
  const deviceCode = generateToken(DEVICE_CODE_PREFIX);
  const expiresAt = new Date(nowOf(deps).getTime() + DEVICE_CODE_TTL_MS);
  // A clash of the short code with another pending one is rare; try a fresh code.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = userCode();
    const inserted = await deps.db
      .insert(oauthDeviceCodes)
      .values({
        clientId: input.client_id,
        deviceName: input.device_name ?? client.name,
        deviceCodeHash: digestToken(deviceCode),
        userCode: code,
        intervalSeconds: DEVICE_POLL_SECONDS,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: oauthDeviceCodes.id });
    if (inserted.length === 0) continue;
    const verification = appLink(deps.publicUrl, DEVICE_VERIFICATION_PATH);
    return {
      device_code: deviceCode,
      user_code: code,
      verification_uri: verification,
      verification_uri_complete: `${verification}?code=${encodeURIComponent(code)}`,
      expires_in: DEVICE_CODE_TTL_MS / 1000,
      interval: DEVICE_POLL_SECONDS,
    };
  }
  throw new OAuthProtocolError('temporarily_unavailable', 'Try again in a moment', 503);
}

async function pendingRequest(deps: OAuthDependencies, code: string) {
  const [row] = await deps.db
    .select()
    .from(oauthDeviceCodes)
    .where(
      and(
        eq(oauthDeviceCodes.userCode, code),
        eq(oauthDeviceCodes.status, 'pending'),
        gt(oauthDeviceCodes.expiresAt, nowOf(deps)),
      ),
    );
  if (!row) {
    throw new NotFoundError(
      'That code is not valid or has expired. Start signing in again on your device.',
    );
  }
  return row;
}

/** What /device shows before the person approves. */
export async function previewDevice(
  deps: OAuthDependencies,
  ctx: RequestContext,
  code: string,
): Promise<OAuthDeviceRequest> {
  sessionUserId(ctx);
  const row = await pendingRequest(deps, code);
  const client = DEVICE_CLIENTS[row.clientId];
  return {
    userCode: row.userCode,
    clientName: client?.name ?? row.clientId,
    deviceName: row.deviceName,
    modules: [...(client?.modules ?? [])],
    access: 'write',
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function decideDevice(
  deps: OAuthDependencies,
  ctx: RequestContext,
  input: DecideOAuthDeviceInput,
): Promise<OAuthDeviceDecision> {
  const userId = sessionUserId(ctx);
  const row = await pendingRequest(deps, input.userCode);
  const status = input.approve ? 'approved' : 'denied';
  await deps.db.transaction(async (tx) => {
    await tx
      .update(oauthDeviceCodes)
      .set({ status, userId, updatedAt: nowOf(deps) })
      .where(and(eq(oauthDeviceCodes.id, row.id), eq(oauthDeviceCodes.status, 'pending')));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: input.approve ? 'oauth.device_approved' : 'oauth.device_denied',
      target: { kind: 'oauth_device', id: row.id },
      after: { clientId: row.clientId, deviceName: row.deviceName },
      meta: ctx,
    });
  });
  return { status };
}

async function poll(tx: Database, row: typeof oauthDeviceCodes.$inferSelect, now: Date) {
  const tooSoon =
    row.lastPolledAt && now.getTime() - row.lastPolledAt.getTime() < row.intervalSeconds * 1000;
  await tx
    .update(oauthDeviceCodes)
    .set({
      lastPolledAt: now,
      intervalSeconds: tooSoon ? row.intervalSeconds + 5 : row.intervalSeconds,
      updatedAt: now,
    })
    .where(eq(oauthDeviceCodes.id, row.id));
  return tooSoon
    ? new OAuthProtocolError('slow_down', `Poll at most every ${row.intervalSeconds + 5} seconds`)
    : new OAuthProtocolError('authorization_pending', 'The person has not approved it yet');
}

/** The token endpoint's device_code grant: pending, refused, expired, or the API token. */
export async function exchangeDeviceCode(
  deps: OAuthDependencies,
  input: { device_code: string; client_id: string },
) {
  const client = clientOf(deps, input.client_id);
  const now = nowOf(deps);
  const outcome = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(oauthDeviceCodes)
      .where(eq(oauthDeviceCodes.deviceCodeHash, digestToken(input.device_code)))
      .for('update');
    if (!row || row.clientId !== input.client_id)
      return invalidGrant('The device code is not valid');
    if (row.status === 'consumed') return invalidGrant('The device code was already used');
    if (row.status === 'denied') {
      return new OAuthProtocolError('access_denied', 'The sign-in was refused');
    }
    if (row.expiresAt <= now) return new OAuthProtocolError('expired_token', 'The code expired');
    if (row.status === 'pending' || !row.userId) return poll(tx, row, now);
    const [person] = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, row.userId));
    if (person?.status !== 'active') return invalidGrant('The account is not active');
    const created = await issueApiToken(
      tx,
      {
        userId: row.userId,
        name: row.deviceName,
        scopes: ['read', 'write'],
        modules: client.modules,
        expiresAt: new Date(now.getTime() + DEVICE_TOKEN_TTL_MS),
      },
      { actor: { kind: 'user', id: row.userId } },
    );
    await tx
      .update(oauthDeviceCodes)
      .set({ status: 'consumed', apiTokenId: created.apiToken.id, updatedAt: now })
      .where(eq(oauthDeviceCodes.id, row.id));
    return created.token;
  });
  if (outcome instanceof OAuthProtocolError) throw outcome;
  return {
    access_token: outcome,
    token_type: 'Bearer' as const,
    expires_in: DEVICE_TOKEN_TTL_MS / 1000,
    scope: 'read write',
  };
}
