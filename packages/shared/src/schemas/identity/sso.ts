import { z } from 'zod';

/** The single sign-on protocols an identity provider can speak; one implementation each. */
export const SSO_PROTOCOLS = ['oidc', 'saml'] as const;
export const ssoProtocolSchema = z.enum(SSO_PROTOCOLS);

/**
 * Why a sign-in through an identity provider did not finish. The callback redirects to the
 * sign-in page with one of these, and the page says what happened and what to do next.
 */
export const SSO_FAILURE_REASONS = [
  'expired',
  'state_mismatch',
  'provider_error',
  'invalid_response',
  'replayed',
  'email_missing',
  'email_unverified',
  'domain_not_allowed',
  'not_provisioned',
  'deactivated',
  'disabled',
] as const;
export const ssoFailureReasonSchema = z.enum(SSO_FAILURE_REASONS);

const groupName = z.string().trim().min(1).max(256);
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/, 'A domain such as acme.dev');

export const ssoRoleMappingSchema = z.object({ group: groupName, roleId: z.uuid() });
export const ssoTeamMappingSchema = z.object({ group: groupName, teamId: z.uuid() });

const httpsOrLocalUrl = z.url({ protocol: /^https?$/ }).max(2048);

export const oidcConfigInputSchema = z.object({
  protocol: z.literal('oidc'),
  /** The issuer; its `/.well-known/openid-configuration` is read for everything else. */
  issuerUrl: httpsOrLocalUrl,
  clientId: z.string().trim().min(1).max(512),
  /** Write-only. Omitted on an update keeps the stored secret. */
  clientSecret: z.string().min(1).max(4096).optional(),
  scopes: z
    .array(z.string().regex(/^[\x21\x23-\x5b\x5d-\x7e]+$/, 'A scope such as "groups"'))
    .max(20)
    .default(['openid', 'email', 'profile']),
  /** The id_token or userinfo claim that lists the person's groups. */
  groupsClaim: z.string().trim().min(1).max(128).default('groups'),
});

const pemCertificate = z
  .string()
  .trim()
  .min(64)
  .max(16_384)
  .refine(
    (value) => /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(value),
    'Paste the certificate in PEM form, from BEGIN CERTIFICATE to END CERTIFICATE',
  );

export const samlConfigInputSchema = z.object({
  protocol: z.literal('saml'),
  idpEntityId: z.string().trim().min(1).max(1024),
  idpSsoUrl: httpsOrLocalUrl,
  /** The identity provider's signing certificate; every assertion must verify against it. */
  idpCertificate: pemCertificate,
  emailAttribute: z.string().trim().min(1).max(256).default('email'),
  nameAttribute: z.string().trim().min(1).max(256).default('name'),
  groupsAttribute: z.string().trim().min(1).max(256).default('groups'),
});

export const ssoConfigInputSchema = z.discriminatedUnion('protocol', [
  oidcConfigInputSchema,
  samlConfigInputSchema,
]);

const providerFields = {
  displayName: z.string().trim().min(1).max(80),
  /** A preset's id from the presets list, kept only to show its logo and help text. */
  preset: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,39}$/)
    .nullable()
    .default(null),
  enabled: z.boolean().default(true),
  /** Create the person on first sign-in; otherwise only existing people may sign in. */
  autoProvision: z.boolean().default(true),
  defaultRoleId: z.uuid().nullable().default(null),
  /** Empty allows any domain the identity provider vouches for. */
  allowedDomains: z.array(domainSchema).max(50).default([]),
  roleMappings: z.array(ssoRoleMappingSchema).max(100).default([]),
  teamMappings: z.array(ssoTeamMappingSchema).max(200).default([]),
};

export const createSsoProviderSchema = z.object({
  ...providerFields,
  config: ssoConfigInputSchema,
});

export const updateSsoProviderSchema = z
  .object({
    displayName: providerFields.displayName,
    preset: providerFields.preset.unwrap(),
    enabled: z.boolean(),
    autoProvision: z.boolean(),
    defaultRoleId: z.uuid().nullable(),
    allowedDomains: providerFields.allowedDomains.unwrap(),
    roleMappings: providerFields.roleMappings.unwrap(),
    teamMappings: providerFields.teamMappings.unwrap(),
    config: ssoConfigInputSchema,
  })
  .partial();

export const oidcConfigSchema = oidcConfigInputSchema
  .omit({ clientSecret: true })
  .extend({ hasClientSecret: z.boolean() });

export const samlConfigSchema = samlConfigInputSchema.omit({ idpCertificate: true }).extend({
  /** SHA-256 fingerprint and expiry of the stored certificate; the PEM itself is not echoed. */
  certificateFingerprint: z.string(),
  certificateExpiresAt: z.string().nullable(),
});

export const ssoTestResultSchema = z.object({
  at: z.string(),
  ok: z.boolean(),
  reason: ssoFailureReasonSchema.nullable(),
  message: z.string().nullable(),
  email: z.string().nullable(),
  groups: z.array(z.string()),
});

/** What the identity provider needs from this workspace, to paste into its app settings. */
export const ssoServiceProviderSchema = z.object({
  /** OIDC redirect URI, or SAML assertion consumer service URL. */
  callbackUrl: z.string(),
  /** SAML entity id (audience); for OIDC the same value identifies the workspace. */
  entityId: z.string(),
  metadataUrl: z.string().nullable(),
});

export const ssoProviderSchema = z.object({
  id: z.uuid(),
  protocol: ssoProtocolSchema,
  displayName: z.string(),
  preset: z.string().nullable(),
  enabled: z.boolean(),
  autoProvision: z.boolean(),
  defaultRoleId: z.uuid().nullable(),
  allowedDomains: z.array(z.string()),
  roleMappings: z.array(ssoRoleMappingSchema),
  teamMappings: z.array(ssoTeamMappingSchema),
  config: z.discriminatedUnion('protocol', [oidcConfigSchema, samlConfigSchema]),
  serviceProvider: ssoServiceProviderSchema,
  lastTest: ssoTestResultSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ssoProvidersResponseSchema = z.object({ items: z.array(ssoProviderSchema) });

export const breakGlassAdminSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
});

/** An active org admin, and whether they keep password sign-in while SSO is required. */
export const ssoPolicyAdminSchema = breakGlassAdminSchema.extend({
  breakGlass: z.boolean(),
  /** Without a password sign-in there is nothing to fall back on, so they cannot be one. */
  hasPassword: z.boolean(),
});

export const ssoPolicySchema = z.object({
  /** Password sign-in is off for everyone except break-glass accounts. */
  requireSso: z.boolean(),
  breakGlassAdmins: z.array(breakGlassAdminSchema),
  /** Every active org admin, for marking and unmarking break-glass admins. */
  admins: z.array(ssoPolicyAdminSchema),
});

export const updateSsoPolicySchema = z.object({ requireSso: z.boolean() });

/** What the sign-in page may know before anyone signs in: names, never configuration. */
export const ssoSignInOptionSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  protocol: ssoProtocolSchema,
  preset: z.string().nullable(),
});

export const ssoSignInOptionsResponseSchema = z.object({
  items: z.array(ssoSignInOptionSchema),
  requireSso: z.boolean(),
});

export const ssoStartQuerySchema = z.object({
  /** A path inside this workspace to land on after signing in; anything else is ignored. */
  returnTo: z.string().max(2048).optional(),
});

export const oidcCallbackQuerySchema = z
  .object({
    state: z.string().min(16).max(512).optional(),
    code: z.string().min(1).max(4096).optional(),
    error: z.string().max(256).optional(),
    error_description: z.string().max(2048).optional(),
  })
  .loose();

export const samlCallbackBodySchema = z.object({
  SAMLResponse: z.string().min(1).max(1_000_000),
  RelayState: z.string().min(16).max(512),
});

export const ssoCompleteQuerySchema = z.object({ state: z.string().min(16).max(512) });

export const ssoTestStartedSchema = z.object({
  /** Open this in the browser that asked; the result lands on the provider's `lastTest`. */
  authorizationUrl: z.string(),
});

export const SCIM_TOKEN_PREFIX = 'bmscim_';

export const createScimTokenSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const scimTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const scimTokensResponseSchema = z.object({
  items: z.array(scimTokenSchema),
  /** Where the identity provider sends provisioning requests. */
  baseUrl: z.string(),
});

/** The secret appears in this response only; it is stored as a hash. */
export const createdScimTokenSchema = z.object({ token: z.string(), scimToken: scimTokenSchema });

export type SsoProtocol = z.infer<typeof ssoProtocolSchema>;
export type SsoFailureReason = z.infer<typeof ssoFailureReasonSchema>;
export type SsoRoleMapping = z.infer<typeof ssoRoleMappingSchema>;
export type SsoTeamMapping = z.infer<typeof ssoTeamMappingSchema>;
export type OidcConfigInput = z.infer<typeof oidcConfigInputSchema>;
export type SamlConfigInput = z.infer<typeof samlConfigInputSchema>;
export type SsoConfigInput = z.infer<typeof ssoConfigInputSchema>;
export type CreateSsoProviderInput = z.infer<typeof createSsoProviderSchema>;
export type UpdateSsoProviderInput = z.infer<typeof updateSsoProviderSchema>;
export type OidcConfig = z.infer<typeof oidcConfigSchema>;
export type SamlConfig = z.infer<typeof samlConfigSchema>;
export type SsoTestResult = z.infer<typeof ssoTestResultSchema>;
export type SsoServiceProvider = z.infer<typeof ssoServiceProviderSchema>;
export type SsoProvider = z.infer<typeof ssoProviderSchema>;
export type SsoProvidersResponse = z.infer<typeof ssoProvidersResponseSchema>;
export type BreakGlassAdmin = z.infer<typeof breakGlassAdminSchema>;
export type SsoPolicyAdmin = z.infer<typeof ssoPolicyAdminSchema>;
export type SsoPolicy = z.infer<typeof ssoPolicySchema>;
export type UpdateSsoPolicyInput = z.infer<typeof updateSsoPolicySchema>;
export type SsoSignInOption = z.infer<typeof ssoSignInOptionSchema>;
export type SsoSignInOptionsResponse = z.infer<typeof ssoSignInOptionsResponseSchema>;
export type SsoStartQuery = z.infer<typeof ssoStartQuerySchema>;
export type OidcCallbackQuery = z.infer<typeof oidcCallbackQuerySchema>;
export type SamlCallbackBody = z.infer<typeof samlCallbackBodySchema>;
export type CreateScimTokenInput = z.infer<typeof createScimTokenSchema>;
export type ScimToken = z.infer<typeof scimTokenSchema>;
export type ScimTokensResponse = z.infer<typeof scimTokensResponseSchema>;
export type CreatedScimToken = z.infer<typeof createdScimTokenSchema>;
export type SsoTestStarted = z.infer<typeof ssoTestStartedSchema>;
