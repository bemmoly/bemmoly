import {
  UnauthenticatedError,
  type OidcConfigInput,
  type SamlConfigInput,
  type SsoFailureReason,
  type SsoProtocol,
} from '@bemmoly/shared';
import type { AddressPolicy } from '../../clients/guarded-fetch.ts';

/** A provider's stored configuration, secrets included; only ever held decrypted in memory. */
export type StoredOidcConfig = Omit<OidcConfigInput, 'clientSecret'> & { clientSecret?: string };
export type StoredSamlConfig = SamlConfigInput;
export type StoredConfig = StoredOidcConfig | StoredSamlConfig;

/** What this workspace calls itself towards identity providers. */
export interface ServiceProviderUrls {
  /** OIDC redirect URI or SAML assertion consumer service URL. */
  callbackUrl: string;
  /** SAML entity id and audience. */
  entityId: string;
}

/** Per-flow secrets, sealed on the flow row between the redirect out and the callback. */
export interface FlowSecrets {
  nonce?: string;
  codeVerifier?: string;
}

export interface BeginInput {
  /** The opaque state (OIDC) or RelayState (SAML) the provider sends back. */
  state: string;
  urls: ServiceProviderUrls;
}

export interface BeginResult {
  redirectUrl: string;
  secrets: FlowSecrets;
  /** The SAML AuthnRequest id the response must answer. */
  requestId?: string;
}

export interface CompleteInput {
  /** The callback's query (OIDC) or form body (SAML), as received. */
  params: Readonly<Record<string, string>>;
  secrets: FlowSecrets;
  requestId: string | null;
  urls: ServiceProviderUrls;
  now: Date;
}

/** The person as the identity provider vouched for them, in this system's shape. */
export interface ExternalIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  groups: string[];
  /** SAML assertion id and when it stops being valid, for replay protection. */
  assertion?: { id: string; expiresAt: Date };
}

/** One sign-in protocol. Adding one is a file implementing this plus a line in registry.ts. */
export interface SsoProtocolHandler {
  begin(input: BeginInput): Promise<BeginResult>;
  complete(input: CompleteInput): Promise<ExternalIdentity>;
}

export interface ProtocolContext {
  /** Which addresses calls to the identity provider may reach. */
  addressPolicy: AddressPolicy;
  /** Tests pass the in-process fake provider's fetch. */
  fetch?: typeof fetch;
}

export type ProtocolFactory<Config extends StoredConfig> = (
  config: Config,
  context: ProtocolContext,
) => SsoProtocolHandler;

/**
 * A sign-in through an identity provider that did not verify. The reason is closed and safe
 * to show; the message, logged, says what exactly failed.
 */
export class SsoFailure extends UnauthenticatedError {
  readonly reason: SsoFailureReason;

  constructor(reason: SsoFailureReason, message: string, options: { cause?: unknown } = {}) {
    super(message, { details: { reason }, ...options });
    this.reason = reason;
  }
}

export const isSsoProtocol = (value: string): value is SsoProtocol =>
  value === 'oidc' || value === 'saml';
