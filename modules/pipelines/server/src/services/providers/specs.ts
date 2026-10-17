import { z } from 'zod';
import type { CloudResourceKind } from '../../../../shared/clouds.ts';

/*
 * The neutral spec of each landing zone kind: what the reconciler declares and every
 * provider maps to its own calls. Nothing here names a cloud's roles or APIs; "containers"
 * is Cloud Run's API on Google Cloud and ECS's on AWS, decided inside each provider.
 */

export const FEATURES = [
  'containers',
  'registry',
  'secrets',
  'metrics',
  'logging',
  'identity',
  'builds',
  'network',
] as const;

export type Feature = (typeof FEATURES)[number];

const labelsSchema = z.record(z.string(), z.string());

export const SPEC_SCHEMAS = {
  /** A project or account; `folder` groups it under the boundary (a domain, say). */
  account: z.object({
    displayName: z.string(),
    folder: z.string().nullable(),
    labels: labelsSchema,
  }),
  service_api: z.object({ features: z.array(z.enum(FEATURES)) }),
  network: z.object({ name: z.string(), subnets: z.enum(['auto', 'custom']) }),
  /** The identity Pipelines acts as for every deploy into this account. */
  deployer_identity: z.object({ name: z.string() }),
  /** What the application runs as, or what builds run as in the CI account. */
  runtime_identity: z.object({ name: z.string(), purpose: z.enum(['runtime', 'build']) }),
  /** Pull (or push) access to the shared image registry for this account's identity. */
  registry_access: z.object({
    registryAccount: z.string(),
    repository: z.string(),
    region: z.string(),
    access: z.enum(['pull', 'push']),
    identity: z.string(),
  }),
  budget: z.object({
    monthly: z.number().positive(),
    currency: z.string().length(3),
    alerts: z.array(z.number().positive()),
  }),
  logging: z.object({ retentionDays: z.number().int().positive() }),
  /** Which of the account's identities may read the secrets stored in it. */
  secret_store: z.object({ readers: z.array(z.string()) }),
} satisfies Record<CloudResourceKind, z.ZodType>;

export type SpecOf<Kind extends CloudResourceKind> = z.infer<(typeof SPEC_SCHEMAS)[Kind]>;
