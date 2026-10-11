import { and, eq, isNull, lte } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  authSsoAssertions,
  authSsoFlows,
  type AuthSsoFlowRow,
} from '../../models/identity/index.ts';
import { digestsEqual, digestToken } from '../identity/index.ts';
import type { SecretBox } from '../settings/index.ts';
import { flowContext } from './deps.ts';
import { SsoFailure, type FlowSecrets } from './protocol.ts';

/** Long enough to type a password and pass a second factor at the identity provider. */
export const FLOW_TTL_MS = 10 * 60 * 1000;

export interface NewFlow {
  providerId: string;
  state: string;
  binding: string;
  secrets: FlowSecrets;
  requestId: string | null;
  returnTo: string;
  testUserId: string | null;
  now: Date;
}

export async function insertFlow(
  db: Database,
  secretsBox: SecretBox,
  flow: NewFlow,
): Promise<Date> {
  const stateHash = digestToken(flow.state);
  const expiresAt = new Date(flow.now.getTime() + FLOW_TTL_MS);
  await db.insert(authSsoFlows).values({
    providerId: flow.providerId,
    stateHash,
    bindingHash: digestToken(flow.binding),
    secretsEncrypted: secretsBox.seal(JSON.stringify(flow.secrets), flowContext(stateHash)),
    requestId: flow.requestId,
    returnTo: flow.returnTo,
    testUserId: flow.testUserId,
    expiresAt,
  });
  return expiresAt;
}

/** The live flow a state names, for this provider; every other case is one closed reason. */
export async function findFlow(
  db: Database,
  state: string | undefined,
  now: Date,
  providerId?: string,
): Promise<AuthSsoFlowRow> {
  if (!state) throw new SsoFailure('state_mismatch', 'The callback carried no state');
  const [flow] = await db
    .select()
    .from(authSsoFlows)
    .where(eq(authSsoFlows.stateHash, digestToken(state)))
    .limit(1);
  if (!flow || (providerId && flow.providerId !== providerId)) {
    throw new SsoFailure('state_mismatch', 'No sign-in was started with this state');
  }
  if (flow.consumedAt) throw new SsoFailure('replayed', 'This sign-in was already used');
  if (flow.expiresAt <= now) throw new SsoFailure('expired', 'This sign-in took too long');
  return flow;
}

/** The browser finishing the flow is the one that started it: its cookie matches. */
export function assertBinding(flow: AuthSsoFlowRow, cookie: string | undefined): void {
  if (!cookie || !digestsEqual(digestToken(cookie), flow.bindingHash)) {
    throw new SsoFailure('state_mismatch', 'This sign-in was started in another browser');
  }
}

/** Marks the flow used, atomically: of two racing callbacks exactly one proceeds. */
export async function consumeFlow(db: Database, flow: AuthSsoFlowRow, now: Date): Promise<void> {
  const claimed = await db
    .update(authSsoFlows)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(authSsoFlows.id, flow.id), isNull(authSsoFlows.consumedAt)))
    .returning({ id: authSsoFlows.id });
  if (claimed.length === 0) throw new SsoFailure('replayed', 'This sign-in was already used');
}

export function openFlowSecrets(secretsBox: SecretBox, flow: AuthSsoFlowRow): FlowSecrets {
  return JSON.parse(
    secretsBox.open(flow.secretsEncrypted, flowContext(flow.stateHash)),
  ) as FlowSecrets;
}

/** A SAML assertion is accepted once; a second POST of the same one is a replay. */
export async function rememberAssertion(
  db: Database,
  providerId: string,
  assertion: { id: string; expiresAt: Date },
): Promise<void> {
  const inserted = await db
    .insert(authSsoAssertions)
    .values({ providerId, assertionId: assertion.id, expiresAt: assertion.expiresAt })
    .onConflictDoNothing()
    .returning({ id: authSsoAssertions.id });
  if (inserted.length === 0) throw new SsoFailure('replayed', 'This assertion was already used');
}

export async function storeFlowResult(db: Database, flow: AuthSsoFlowRow, result: unknown) {
  await db
    .update(authSsoFlows)
    .set({ result, updatedAt: new Date() })
    .where(and(eq(authSsoFlows.id, flow.id), isNull(authSsoFlows.result)));
}

/** Housekeeping: finished and abandoned flows, and assertion ids past their expiry. */
export async function deleteExpiredSsoState(db: Database, now: Date): Promise<number> {
  const flows = await db
    .delete(authSsoFlows)
    .where(lte(authSsoFlows.expiresAt, now))
    .returning({ id: authSsoFlows.id });
  const assertions = await db
    .delete(authSsoAssertions)
    .where(lte(authSsoAssertions.expiresAt, now))
    .returning({ id: authSsoAssertions.id });
  return flows.length + assertions.length;
}
