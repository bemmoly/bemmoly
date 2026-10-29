import {
  autopilotPoolBodySchema,
  DEFAULT_BUILDER_IMAGE,
  type AutopilotPoolBody,
  type RunnerPool,
} from '@bemmoly/module-pipelines/shared';
import {
  projectOf,
  regionOfDraft,
  serviceAccountOfDraft,
  type BuildProject,
} from './build-projects.ts';
import type { PoolDraft } from './pool-draft.ts';

/*
 * A GKE Autopilot pool's part of the pool dialog: the cluster (Pipelines creates it in a CI
 * project it made, or the admin names one that exists), the size each runner pod asks for,
 * Spot or standard capacity, and the image builds run in. The project, region, runner image
 * and service account are shared with the Cloud Build fields.
 */

export const DEFAULT_CLUSTER = 'bemmoly-runners';

export interface AutopilotDraft {
  cluster: string;
  /** Null follows the project: create the cluster in a CI project Pipelines made. */
  createCluster: boolean | null;
  cpu: string;
  memory: string;
  spot: boolean;
  /** Empty keeps Kaniko, the default. */
  builderImage: string;
}

export const AUTOPILOT_DRAFT: AutopilotDraft = {
  cluster: DEFAULT_CLUSTER,
  createCluster: null,
  cpu: '2',
  memory: '8',
  spot: false,
  builderImage: '',
};

export function autopilotDraftOf(pool: RunnerPool): AutopilotDraft {
  const autopilot = pool.autopilot;
  if (!autopilot) return AUTOPILOT_DRAFT;
  return {
    cluster: autopilot.cluster.name,
    createCluster: autopilot.cluster.create,
    cpu: String(autopilot.cpu),
    memory: String(autopilot.memoryGb),
    spot: autopilot.spot,
    builderImage: autopilot.builderImage === DEFAULT_BUILDER_IMAGE ? '' : autopilot.builderImage,
  };
}

/** Pipelines may create a cluster only in a project it made, on a managed connection. */
export const mayCreateCluster = (draft: PoolDraft, projects: readonly BuildProject[]) =>
  projectOf(projects, draft.accountId)?.created ?? false;

export const createsCluster = (draft: PoolDraft, projects: readonly BuildProject[]) =>
  mayCreateCluster(draft, projects) && (draft.createCluster ?? true);

export function autopilotBodyOf(
  draft: PoolDraft,
  projects: readonly BuildProject[],
): AutopilotPoolBody {
  const builder = draft.builderImage.trim();
  return {
    account: draft.accountId ?? '',
    location: regionOfDraft(draft, projects).trim(),
    cluster: { name: draft.cluster.trim(), create: createsCluster(draft, projects) },
    image: draft.image.trim(),
    cpu: Number(draft.cpu),
    memoryGb: Number(draft.memory),
    spot: draft.spot,
    serviceAccount: serviceAccountOfDraft(draft, projects).trim(),
    builderImage: builder || DEFAULT_BUILDER_IMAGE,
  };
}

const FIELDS = [
  'account',
  'location',
  'cluster',
  'image',
  'cpu',
  'memoryGb',
  'serviceAccount',
  'builderImage',
] as const;
export type AutopilotField = (typeof FIELDS)[number];

/** Which GKE Autopilot field is wrong, so the dialog marks it; empty when all are right. */
export function autopilotProblems(
  draft: PoolDraft,
  projects: readonly BuildProject[],
): AutopilotField[] {
  if (draft.kind !== 'gke-autopilot') return [];
  const parsed = autopilotPoolBodySchema.safeParse(autopilotBodyOf(draft, projects));
  if (parsed.success) return [];
  const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  return FIELDS.filter((field) => fields.has(field));
}

export function autopilotChanged(now: RunnerPool['autopilot'], next: AutopilotPoolBody): boolean {
  if (!now) return true;
  return (
    now.account.id !== next.account ||
    now.location !== next.location ||
    now.cluster.name !== next.cluster.name ||
    now.cluster.create !== next.cluster.create ||
    now.image !== next.image ||
    now.cpu !== next.cpu ||
    now.memoryGb !== next.memoryGb ||
    now.spot !== next.spot ||
    now.serviceAccount !== next.serviceAccount ||
    now.builderImage !== next.builderImage
  );
}
