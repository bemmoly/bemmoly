import type { LoadedProvider } from './config.ts';
import type { SsoDependencies } from './deps.ts';
import type { SsoProtocolHandler } from './protocol.ts';
import { protocolFor } from './registry.ts';

/** The protocol handler for a loaded provider, with this install's address policy. */
export function registryHandler(
  deps: Pick<SsoDependencies, 'addressPolicy' | 'fetch'>,
  provider: LoadedProvider,
): SsoProtocolHandler {
  return protocolFor(provider.protocol, provider.config, {
    addressPolicy: deps.addressPolicy,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
}
