import { isLinkLocalAddress, PrivateAddressError, resolvePublicAddress } from './network.ts';

/**
 * Which addresses a model provider's calls may reach:
 * - `public`: a catalog provider; no private or link-local address.
 * - `local`: a Local server, private by design; loopback and private networks are fine, but
 *   never link-local, where cloud metadata services answer and no model server does.
 * - `any`: the operator set BEMMOLY_ALLOW_PRIVATE_URLS.
 */
export type AddressPolicy = 'public' | 'local' | 'any';

export class RedirectRefusedError extends Error {
  override readonly name = 'RedirectRefusedError';
}

const LOOKUP_TIMEOUT_MS = 2_000;

/** Checks where a URL points, under the policy, before anything is sent to it. */
export async function assertAddressAllowed(url: string, policy: AddressPolicy): Promise<void> {
  if (policy === 'any') return;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const address = await resolvePublicAddress(host, {
    allowPrivate: policy === 'local',
    timeoutMs: LOOKUP_TIMEOUT_MS,
  });
  if (policy === 'local' && isLinkLocalAddress(address)) {
    throw new PrivateAddressError(
      `${host} resolves to the link-local address ${address}; set BEMMOLY_ALLOW_PRIVATE_URLS=true to allow it`,
    );
  }
}

/**
 * The fetch a provider package is handed: every call is checked against the address policy
 * when it is made (not only when the provider was saved, so a name that later resolves
 * elsewhere is caught), and a redirect is refused rather than followed, since a redirect could
 * lead a checked public address to an unchecked private one.
 */
export function createGuardedFetch(
  policy: AddressPolicy,
  base: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    await assertAddressAllowed(url, policy);
    const response = await base(input, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      throw new RedirectRefusedError(
        `${new URL(url).origin} answered with a redirect; use the address it points to as the base URL`,
      );
    }
    return response;
  };
}
