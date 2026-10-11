import type { SsoTestResult } from '@bemmoly/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authProviders } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import type { LoadedProvider } from './config.ts';
import { SsoFailure, type ExternalIdentity } from './protocol.ts';
import { checkIdentity } from './provisioning.ts';

export type FlowResult =
  { ok: true; identity: ExternalIdentity } | { ok: false; failure: SsoFailure };

function resultOf(provider: LoadedProvider, result: FlowResult, at: Date): SsoTestResult {
  if (!result.ok) {
    return {
      at: at.toISOString(),
      ok: false,
      reason: result.failure.reason,
      message: result.failure.message,
      email: null,
      groups: [],
    };
  }
  const { identity } = result;
  try {
    checkIdentity(provider, identity);
    return {
      at: at.toISOString(),
      ok: true,
      reason: null,
      message: null,
      email: identity.email,
      groups: identity.groups,
    };
  } catch (error) {
    if (!(error instanceof SsoFailure)) throw error;
    return {
      at: at.toISOString(),
      ok: false,
      reason: error.reason,
      message: error.message,
      email: identity.email,
      groups: identity.groups,
    };
  }
}

/**
 * A test sign-in's outcome lands on the provider, where Settings shows it: the address and
 * groups the identity provider sent, or exactly why it failed. Nobody is signed in or created.
 */
export async function recordTest(
  db: Database,
  provider: LoadedProvider,
  testUserId: string,
  result: FlowResult,
  meta: RequestMeta,
): Promise<SsoTestResult> {
  const lastTest = resultOf(provider, result, new Date());
  await db.transaction(async (tx) => {
    await tx.update(authProviders).set({ lastTest }).where(eq(authProviders.id, provider.row.id));
    await recordAudit(tx, {
      actor: { kind: 'user', id: testUserId },
      action: 'sso.provider_tested',
      target: { kind: 'auth_provider', id: provider.row.id },
      after: { ok: lastTest.ok, reason: lastTest.reason },
      meta,
    });
  });
  return lastTest;
}
