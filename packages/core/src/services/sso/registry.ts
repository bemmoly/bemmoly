import type { SsoProtocol } from '@bemmoly/shared';
import type {
  ProtocolContext,
  SsoProtocolHandler,
  StoredConfig,
  StoredOidcConfig,
  StoredSamlConfig,
} from './protocol.ts';
import { createOidcProtocol } from './protocols/oidc.ts';
import { createSamlProtocol } from './protocols/saml.ts';

/** One line per protocol. The config was validated against that protocol's schema when saved. */
const PROTOCOLS: {
  [P in SsoProtocol]: (config: StoredConfig, context: ProtocolContext) => SsoProtocolHandler;
} = {
  oidc: (config, context) => createOidcProtocol(config as StoredOidcConfig, context),
  saml: (config, context) => createSamlProtocol(config as StoredSamlConfig, context),
};

/** The handler for a provider's protocol, built from its decrypted configuration. */
export function protocolFor(
  protocol: SsoProtocol,
  config: StoredConfig,
  context: ProtocolContext,
): SsoProtocolHandler {
  return PROTOCOLS[protocol](config, context);
}
