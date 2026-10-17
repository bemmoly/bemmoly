import type { z } from 'zod';
import type { CloudResourceKind } from '../../../../../shared/clouds.ts';
import type { ConnectionRecord, DesiredResource } from '../contract.ts';
import { SPEC_SCHEMAS, type Feature, type SpecOf } from '../specs.ts';
import type { GcpContext } from './context.ts';

/*
 * How one neutral kind becomes Google Cloud calls. `expected` is what reading it back should
 * show when it matches the spec, in the same shape `read` answers, so diff is a plain
 * comparison and needs no cloud call.
 */

export interface ZoneCall<Kind extends CloudResourceKind> {
  context: GcpContext;
  connection: ConnectionRecord;
  resource: DesiredResource;
  spec: SpecOf<Kind>;
}

export interface ZoneKind<Kind extends CloudResourceKind> {
  expected(spec: SpecOf<Kind>, resource: DesiredResource): Record<string, unknown>;
  read(call: ZoneCall<Kind>): Promise<Record<string, unknown> | null>;
  apply(call: ZoneCall<Kind>): Promise<void>;
}

export const specOf = <Kind extends CloudResourceKind>(
  kind: Kind,
  resource: DesiredResource,
): SpecOf<Kind> => (SPEC_SCHEMAS[kind] as unknown as z.ZodType<SpecOf<Kind>>).parse(resource.spec);

/** The Google APIs behind each neutral feature. */
export const FEATURE_APIS: Readonly<Record<Feature, readonly string[]>> = {
  containers: ['run.googleapis.com'],
  registry: ['artifactregistry.googleapis.com'],
  secrets: ['secretmanager.googleapis.com'],
  metrics: ['monitoring.googleapis.com'],
  logging: ['logging.googleapis.com'],
  identity: ['iam.googleapis.com', 'iamcredentials.googleapis.com'],
  builds: ['cloudbuild.googleapis.com'],
  network: ['compute.googleapis.com'],
};

/** Deploy roles only, scoped to the one project (architecture §15). */
export const DEPLOYER_ROLES = [
  'roles/run.developer',
  'roles/iam.serviceAccountUser',
  'roles/monitoring.viewer',
] as const;

export const IDENTITY_ROLES = {
  runtime: ['roles/logging.logWriter', 'roles/monitoring.metricWriter', 'roles/cloudtrace.agent'],
  build: ['roles/logging.logWriter', 'roles/artifactregistry.writer'],
} as const;

export const TOKEN_CREATOR = 'roles/iam.serviceAccountTokenCreator';
export const SECRET_ACCESSOR = 'roles/secretmanager.secretAccessor';
export const REGISTRY_ROLES = {
  pull: 'roles/artifactregistry.reader',
  push: 'roles/artifactregistry.writer',
} as const;

/** The Cloud Run service agent, which pulls images on the project's behalf. */
export const runServiceAgent = (projectNumber: string) =>
  `serviceAccount:service-${projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`;

export async function projectNumberOf(context: GcpContext, projectId: string): Promise<string> {
  const project = await context.control.resourceManager.getProject(projectId);
  const number = project?.name.split('/').pop();
  if (!number) throw new Error(`Project ${projectId} does not exist yet`);
  return number;
}
