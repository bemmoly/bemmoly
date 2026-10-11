import { assertAddressAllowed, type AddressPolicy } from '../../clients/guarded-fetch.ts';

const MAX_REDIRECTS = 3;

/**
 * The fetch an importer is handed. Every hop is checked against the address policy before
 * anything is sent, so a redirect cannot lead a checked address to an unchecked one; hosted
 * sources send attachment downloads through a redirect, so hops are followed, up to three.
 * Credentials stay with the origin they were meant for and are dropped on a cross-origin hop.
 */
export function createImportFetch(policy: AddressPolicy, base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    let url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    const origin = url.origin;
    for (let hop = 0; ; hop += 1) {
      await assertAddressAllowed(url.href, policy);
      const headers = new Headers(init?.headers);
      if (url.origin !== origin) {
        headers.delete('authorization');
        headers.delete('cookie');
      }
      const response = await base(url, { ...init, headers, redirect: 'manual' });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) return response;
      if (hop >= MAX_REDIRECTS) throw new Error(`${origin} redirected too many times`);
      await response.body?.cancel();
      url = new URL(location, url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error(`${origin} redirected to an unsupported address`);
      }
    }
  };
}
