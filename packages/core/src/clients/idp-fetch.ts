import { createGuardedFetch, type AddressPolicy } from './guarded-fetch.ts';

/** Discovery documents, key sets and token responses are small; nothing legitimate is slower. */
export const IDP_TIMEOUT_MS = 10_000;

/**
 * The fetch the OIDC library is handed for an identity provider: every call carries a hard
 * timeout, is checked against the address policy when it is made, and never follows a
 * redirect. Identity providers are often self-hosted, so private networks are allowed by
 * default (`local`), but link-local addresses, where cloud metadata answers, never are.
 */
export function createIdpFetch(
  policy: AddressPolicy,
  base: typeof fetch = fetch,
  timeoutMs = IDP_TIMEOUT_MS,
): typeof fetch {
  const guarded = createGuardedFetch(policy, base);
  return async (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return guarded(input, { ...init, signal });
  };
}
