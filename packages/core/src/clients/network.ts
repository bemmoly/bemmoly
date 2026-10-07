import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6');
}

/** Loopback, link-local, private and carrier-grade NAT ranges, including IPv4-mapped IPv6. */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return privateRanges.check(mapped, 'ipv4');
  const family = isIP(address);
  if (family === 0) return false;
  return privateRanges.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class PrivateAddressError extends Error {
  override readonly name = 'PrivateAddressError';
}

export class HostLookupError extends Error {
  override readonly name = 'HostLookupError';
}

/**
 * Resolves a host once and returns the address to connect to, refusing private
 * addresses unless the operator allowed them. Connecting to the returned address
 * (not the name) keeps a second lookup from answering differently.
 */
export async function resolvePublicAddress(
  host: string,
  options: { allowPrivate: boolean; timeoutMs: number },
): Promise<string> {
  let address: string;
  if (isIP(host)) {
    address = host;
  } else {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new HostLookupError(`Looking up ${host} took longer than ${options.timeoutMs} ms`),
          ),
        options.timeoutMs,
      );
    });
    try {
      address = (await Promise.race([lookup(host), timeout])).address;
    } catch (error) {
      if (error instanceof HostLookupError) throw error;
      throw new HostLookupError(`The host name ${host} could not be found`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
  if (!options.allowPrivate && isPrivateAddress(address)) {
    throw new PrivateAddressError(
      `${host} resolves to the private address ${address}; set BEMMOLY_ALLOW_PRIVATE_URLS=true to allow it`,
    );
  }
  return address;
}
