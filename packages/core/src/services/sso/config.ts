import { createHash, X509Certificate } from 'node:crypto';
import {
  NotFoundError,
  ssoRoleMappingSchema,
  ssoTeamMappingSchema,
  ssoTestResultSchema,
  type SsoProtocol,
  type SsoProvider,
  type SsoRoleMapping,
  type SsoTeamMapping,
  type SsoTestResult,
} from '@bemmoly/shared';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../clients/drizzle.ts';
import { authProviders, type AuthProviderRow } from '../../models/identity/index.ts';
import type { SecretBox } from '../settings/index.ts';
import { configContext, serviceProviderUrls } from './deps.ts';
import {
  isSsoProtocol,
  type StoredConfig,
  type StoredOidcConfig,
  type StoredSamlConfig,
} from './protocol.ts';

export interface LoadedProvider {
  row: AuthProviderRow;
  protocol: SsoProtocol;
  config: StoredConfig;
  allowedDomains: string[];
  roleMappings: SsoRoleMapping[];
  teamMappings: SsoTeamMapping[];
}

const listOf = <T>(schema: z.ZodType<T>, value: unknown): T[] => {
  const parsed = z.array(schema).safeParse(value);
  return parsed.success ? parsed.data : [];
};

export function openConfig(secrets: SecretBox, row: AuthProviderRow): StoredConfig {
  if (!row.configEncrypted) throw new Error(`SSO provider ${row.id} has no configuration`);
  return JSON.parse(secrets.open(row.configEncrypted, configContext(row.id))) as StoredConfig;
}

export function sealConfig(secrets: SecretBox, providerId: string, config: StoredConfig): string {
  return secrets.seal(JSON.stringify(config), configContext(providerId));
}

export function loadedOf(secrets: SecretBox, row: AuthProviderRow): LoadedProvider {
  if (!isSsoProtocol(row.kind)) throw new NotFoundError('Single sign-on provider not found');
  return {
    row,
    protocol: row.kind,
    config: openConfig(secrets, row),
    allowedDomains: listOf(z.string(), row.allowedDomains),
    roleMappings: listOf(ssoRoleMappingSchema, row.roleMappings),
    teamMappings: listOf(ssoTeamMappingSchema, row.groupMappings),
  };
}

/** An SSO provider row (never the password row), or 404. */
export async function findProviderRow(db: Database, id: string): Promise<AuthProviderRow> {
  const [row] = await db
    .select()
    .from(authProviders)
    .where(and(eq(authProviders.id, id), ne(authProviders.kind, 'password')))
    .limit(1);
  if (!row) throw new NotFoundError('Single sign-on provider not found');
  return row;
}

export async function loadProvider(
  db: Database,
  secrets: SecretBox,
  id: string,
): Promise<LoadedProvider> {
  return loadedOf(secrets, await findProviderRow(db, id));
}

function certificateFacts(pem: string) {
  try {
    const certificate = new X509Certificate(pem);
    return {
      certificateFingerprint: certificate.fingerprint256,
      certificateExpiresAt: new Date(certificate.validTo).toISOString(),
    };
  } catch {
    const digest = createHash('sha256').update(pem).digest('hex').toUpperCase();
    return { certificateFingerprint: digest, certificateExpiresAt: null };
  }
}

/** True when the PEM parses as an X.509 certificate. */
export function isCertificate(pem: string): boolean {
  try {
    new X509Certificate(pem);
    return true;
  } catch {
    return false;
  }
}

function presentConfig(protocol: SsoProtocol, config: StoredConfig): SsoProvider['config'] {
  if (protocol === 'oidc') {
    const { clientSecret, ...rest } = config as StoredOidcConfig;
    return { ...rest, protocol: 'oidc', hasClientSecret: Boolean(clientSecret) };
  }
  const { idpCertificate, ...rest } = config as StoredSamlConfig;
  return { ...rest, protocol: 'saml', ...certificateFacts(idpCertificate) };
}

function lastTestOf(value: unknown): SsoTestResult | null {
  const parsed = ssoTestResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The admin view of a provider: configuration without secrets, and what the IdP needs. */
export function presentProvider(provider: LoadedProvider, publicUrl: string): SsoProvider {
  const { row } = provider;
  const urls = serviceProviderUrls(publicUrl, row.id);
  return {
    id: row.id,
    protocol: provider.protocol,
    displayName: row.displayName,
    preset: row.preset,
    enabled: row.enabled,
    autoProvision: row.autoProvision,
    defaultRoleId: row.defaultRoleId,
    allowedDomains: provider.allowedDomains,
    roleMappings: provider.roleMappings,
    teamMappings: provider.teamMappings,
    config: presentConfig(provider.protocol, provider.config),
    serviceProvider: {
      callbackUrl: urls.callbackUrl,
      entityId: urls.entityId,
      metadataUrl: provider.protocol === 'saml' ? urls.entityId : null,
    },
    lastTest: lastTestOf(row.lastTest),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
