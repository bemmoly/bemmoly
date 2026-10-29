import { z } from 'zod';
import { domainRefSchema } from './catalog.ts';
import {
  environmentClassSchema,
  idSchema,
  isoDateTimeSchema,
  providerSchema,
  slugSchema,
} from './common.ts';

/*
 * Platform › Clouds (architecture §14): GET /api/v1/pipelines/clouds/providers,
 * GET/POST /clouds (connections), POST /clouds/:id/check, POST /clouds/:id/plan (the landing
 * zone preview), POST /clouds/:id/apply, GET /clouds/:id/accounts and /resources. Pipelines
 * speaks in neutral words; a provider maps them to its cloud. Nothing is created until Apply.
 */

export const providerInfoSchema = z.object({
  provider: providerSchema,
  name: z.string(),
  /** "Projects in a folder, workload identity, no key files". */
  description: z.string(),
  /** Clouds that are not available yet say "Coming soon" and nothing else. */
  availability: z.enum(['available', 'coming_soon']),
});

export const providersResponseSchema = z.object({ items: z.array(providerInfoSchema) });

export const connectionStatusSchema = z.enum(['pending', 'connected', 'failed', 'disconnected']);
export const layoutSchema = z.enum([
  'per-environment',
  'per-domain-environment',
  'per-group-environment',
]);

/**
 * Managed: Pipelines creates projects inside its folder. Attached: Pipelines deploys into
 * projects that already exist and creates none of them.
 */
export const connectionModeSchema = z.enum(['managed', 'attached']);

/**
 * How Bemmoly signs in to the cloud. "vm" is the service account of the machine it runs on;
 * "application_default" is the gcloud sign-in on this machine, for a laptop install;
 * "workload_identity_file" is a federation file. A service account key is never accepted.
 */
export const signInSchema = z.enum(['vm', 'application_default', 'workload_identity_file']);

/** An image repository such as us-central1-docker.pkg.dev/acme-ci/apps. */
export const registryPathSchema = z
  .string()
  .trim()
  .max(255)
  .regex(
    /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)+$/,
    'Name a repository such as us-central1-docker.pkg.dev/my-project/apps',
  );

export const cloudConnectionSchema = z.object({
  id: idSchema,
  provider: providerSchema,
  name: z.string(),
  mode: connectionModeSchema,
  signIn: signInSchema.nullable(),
  /** Where services go when an environment names no region. */
  region: z.string().nullable(),
  /** Where runners push images they build; null keeps images on the runner's machine. */
  registry: z.string().nullable(),
  /** The attached project chosen to hold CI secrets and secrets for every environment. */
  ciAccountId: idSchema.nullable(),
  status: connectionStatusSchema,
  /** "bemmoly-control@acme-bemmoly". */
  principal: z.string().nullable(),
  /** The folder or organizational unit Pipelines works inside. */
  boundary: z.string().nullable(),
  layout: layoutSchema,
  lastCheckedAt: isoDateTimeSchema.nullable(),
  /** What to do next, in plain words, when the last check failed. */
  lastError: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export const connectionsResponseSchema = z.object({ items: z.array(cloudConnectionSchema) });

/**
 * The local provider's Docker daemon: a docker or podman socket on this machine, or a daemon on
 * loopback. Anything else would let a connection send Engine API calls to any host or socket.
 */
export function isLocalDockerHost(value: string): boolean {
  const unix = /^unix:\/\/(\/[^\0?#]*\/(?:docker|podman)\.sock)$/.exec(value);
  if (unix) return !(unix[1] ?? '').split('/').includes('..');
  const tcp = /^tcp:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):([0-9]{1,5})$/.exec(value);
  const port = Number(tcp?.[1]);
  return port > 0 && port < 65536;
}

export const dockerHostSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    isLocalDockerHost,
    'Use a socket such as unix:///var/run/docker.sock or tcp://127.0.0.1:2375',
  );

const connectionBase = {
  name: z.string().trim().min(1).max(80),
  layout: layoutSchema.default('per-domain-environment'),
};

export const gcpRegionSchema = z
  .string()
  .regex(/^[a-z]+-[a-z]+[0-9]+$/, 'Name a region such as us-central1');

export const connectCloudBodySchema = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('gcp'),
      ...connectionBase,
      mode: connectionModeSchema.default('managed'),
      signIn: signInSchema.default('vm'),
      /** The external_account file, only with the workload_identity_file sign-in. */
      credentialFile: z.record(z.string(), z.unknown()).optional(),
      region: gcpRegionSchema.default('us-central1'),
      registry: registryPathSchema.optional(),
      organizationId: z
        .string()
        .regex(/^[0-9]{6,20}$/)
        .optional(),
      billingAccountId: z
        .string()
        .regex(/^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/)
        .optional(),
      folderName: z.string().trim().min(1).max(30).default('Bemmoly'),
    })
    .superRefine((body, issues) => {
      if (body.mode === 'managed') {
        if (!body.organizationId) {
          issues.addIssue({
            code: 'custom',
            path: ['organizationId'],
            message: 'Creating projects needs the organization they go in',
          });
        }
        if (!body.billingAccountId) {
          issues.addIssue({
            code: 'custom',
            path: ['billingAccountId'],
            message: 'Creating projects needs the billing account that pays for them',
          });
        }
      }
      if ((body.signIn === 'workload_identity_file') !== Boolean(body.credentialFile)) {
        issues.addIssue({
          code: 'custom',
          path: ['credentialFile'],
          message: 'Upload the workload identity file only with that sign-in',
        });
      }
    }),
  z.object({
    provider: z.literal('aws'),
    ...connectionBase,
    organizationalUnitName: z.string().trim().min(1).max(128).default('Bemmoly'),
    adminEmail: z.email(),
  }),
  z.object({
    provider: z.literal('kubernetes'),
    ...connectionBase,
    apiServer: z.url(),
    namespacePrefix: slugSchema,
    /** A reference to a stored token, never the token itself. */
    tokenRef: z.string().min(1).max(200),
  }),
  z.object({
    provider: z.literal('local'),
    ...connectionBase,
    dockerHost: dockerHostSchema.default('unix:///var/run/docker.sock'),
  }),
]);

export const landingZoneNodeKindSchema = z.enum(['folder', 'account', 'resource']);

export interface LandingZoneNode {
  kind: z.infer<typeof landingZoneNodeKindSchema>;
  name: string;
  note: string | null;
  status: 'exists' | 'create' | 'update' | 'drifted';
  children: LandingZoneNode[];
}

/** The preview tree: what will be created, folder by folder and project by project. */
export const landingZoneNodeSchema: z.ZodType<LandingZoneNode> = z.lazy(() =>
  z.object({
    kind: landingZoneNodeKindSchema,
    name: z.string(),
    /** "runners, registry, caches", "3 regions". */
    note: z.string().nullable(),
    status: z.enum(['exists', 'create', 'update', 'drifted']),
    children: z.array(landingZoneNodeSchema),
  }),
);

export const landingZonePlanBodySchema = z.object({
  layout: layoutSchema.optional(),
  environments: z.array(slugSchema).min(1).optional(),
});

export const landingZonePlanSchema = z.object({
  planId: idSchema,
  connectionId: idSchema,
  layout: layoutSchema,
  root: landingZoneNodeSchema,
  /** "27 projects · 1 folder per domain". */
  counts: z.object({
    folders: z.number().int(),
    accounts: z.number().int(),
    resources: z.number().int(),
  }),
  /** Quota or permission problems found before planning; Apply stays off while any exist. */
  blockers: z.array(z.string()),
  specHash: z.string(),
});

export const applyLandingZoneBodySchema = z.object({
  planId: idSchema,
  /** The hash the person saw, so a changed plan cannot be applied unseen. */
  specHash: z.string().min(1),
});

export const cloudAccountSchema = z.object({
  id: idSchema,
  connectionId: idSchema,
  externalId: z.string(),
  name: z.string(),
  domain: domainRefSchema.nullable(),
  environmentClass: environmentClassSchema.nullable(),
  purpose: z.enum(['workload', 'ci', 'control']),
  status: z.enum(['planned', 'creating', 'ready', 'drifted', 'failed']),
  /** Created by Pipelines' landing zone, or attached as it already was. */
  origin: z.enum(['created', 'attached']),
  /** Who deploys there; null acts as the connection's own identity. */
  deployerServiceAccount: z.string().nullable(),
  /** Who the services run as; null leaves the cloud's default. */
  runtimeServiceAccount: z.string().nullable(),
  /** What the last check found missing, each a sentence saying what to grant. */
  problems: z.array(z.string()),
  lastCheckedAt: isoDateTimeSchema.nullable(),
});

export const cloudResourceKindSchema = z.enum([
  'account',
  'network',
  'registry_access',
  'deployer_identity',
  'runtime_identity',
  'budget',
  'logging',
  'service_api',
  'secret_store',
]);

export const cloudResourceSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  kind: cloudResourceKindSchema,
  name: z.string(),
  desired: z.record(z.string(), z.unknown()),
  observed: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(['pending', 'applying', 'ready', 'drifted', 'failed']),
  lastReconciledAt: isoDateTimeSchema.nullable(),
  lastError: z.string().nullable(),
});

export const cloudAccountsResponseSchema = z.object({ items: z.array(cloudAccountSchema) });
export const cloudResourcesResponseSchema = z.object({ items: z.array(cloudResourceSchema) });
export const connectionParamsSchema = z.object({ id: idSchema });

export type ProviderInfo = z.infer<typeof providerInfoSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type Layout = z.infer<typeof layoutSchema>;
export type CloudConnection = z.infer<typeof cloudConnectionSchema>;
export type ConnectCloudBody = z.input<typeof connectCloudBodySchema>;
export type LandingZonePlanBody = z.infer<typeof landingZonePlanBodySchema>;
export type LandingZonePlan = z.infer<typeof landingZonePlanSchema>;
export type ApplyLandingZoneBody = z.infer<typeof applyLandingZoneBodySchema>;
export type CloudAccount = z.infer<typeof cloudAccountSchema>;
export type CloudResourceKind = z.infer<typeof cloudResourceKindSchema>;
export type CloudResource = z.infer<typeof cloudResourceSchema>;
