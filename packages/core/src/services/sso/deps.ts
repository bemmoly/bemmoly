import type { Database } from '../../clients/drizzle.ts';
import type { AddressPolicy } from '../../clients/guarded-fetch.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { SecretBox } from '../settings/index.ts';
import { appLink } from '../identity/index.ts';
import type { ServiceProviderUrls } from './protocol.ts';

export interface SsoDependencies {
  db: Database;
  /** The pool behind `db`: a break-glass change and its notification commit together. */
  sql: SqlClient;
  /** Tells the other admins when the break-glass admins change. */
  events: EventBus;
  /** Seals provider configuration and per-flow secrets with BEMMOLY_SECRET_KEY. */
  secrets: SecretBox;
  /** BEMMOLY_PUBLIC_URL; callback URLs and the SAML entity id start here. */
  publicUrl: string;
  /** `local` by default (identity providers are often self-hosted); `any` with BEMMOLY_ALLOW_PRIVATE_URLS. */
  addressPolicy: AddressPolicy;
  /** Injected so tests can move time; defaults to the wall clock. */
  now?: () => Date;
  /** Tests hand the in-process fake identity provider's fetch. */
  fetch?: typeof fetch;
}

export const nowOf = (deps: Pick<SsoDependencies, 'now'>): Date =>
  deps.now ? deps.now() : new Date();

export const SSO_API_PATH = '/api/v1/auth/sso';
export const SCIM_PATH = '/scim/v2';

/** The URLs one provider's app registration at the identity provider needs. */
export function serviceProviderUrls(publicUrl: string, providerId: string): ServiceProviderUrls {
  return {
    callbackUrl: appLink(publicUrl, `${SSO_API_PATH}/providers/${providerId}/callback`),
    entityId: appLink(publicUrl, `${SSO_API_PATH}/providers/${providerId}/metadata`),
  };
}

/** Where a SAML POST hands over to a same-site GET that can read the binding cookie. */
export function completeUrl(publicUrl: string, state: string): string {
  return appLink(publicUrl, `${SSO_API_PATH}/complete?state=${encodeURIComponent(state)}`);
}

export const scimBaseUrl = (publicUrl: string) => appLink(publicUrl, SCIM_PATH);

/** The context sealed values are bound to, so a sealed value cannot move between rows. */
export const configContext = (providerId: string) => `auth_providers.config:${providerId}`;
export const flowContext = (stateHash: string) => `auth_sso_flows.secrets:${stateHash}`;
