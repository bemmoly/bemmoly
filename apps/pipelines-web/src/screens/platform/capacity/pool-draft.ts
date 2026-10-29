import {
  cloudBuildPoolBodySchema,
  type CloudBuildMachine,
  type CloudBuildPoolBody,
  type CreatePoolBody,
  type PoolHosting,
  type RunnerPool,
  type UpdatePoolBody,
} from '@bemmoly/module-pipelines/shared';
import { slugOf } from '../../../lib/slug.ts';
import {
  autopilotBodyOf,
  autopilotChanged,
  AUTOPILOT_DRAFT,
  autopilotDraftOf,
  autopilotProblems,
  type AutopilotDraft,
} from './autopilot-draft.ts';
import { regionOfDraft, serviceAccountOfDraft, type BuildProject } from './build-projects.ts';

export {
  buildProjects,
  projectOf,
  regionOfDraft,
  serviceAccountOfDraft,
  type BuildProject,
} from './build-projects.ts';

/*
 * The Add runner pool and Change where it runs dialogs' rules, apart from their drawing. A
 * pool either takes runners people start (on a VM, a laptop, a cluster) or has Pipelines start
 * one machine per job: a Google Cloud Build build, or a pod on GKE Autopilot
 * (autopilot-draft.ts). A field left as null follows its default: the region follows the
 * project's connection, and a CI project Pipelines made suggests its builder service account.
 */

export type PoolKind = 'start' | 'cloud-build' | 'gke-autopilot';
export const POOL_KINDS: readonly PoolKind[] = ['start', 'cloud-build', 'gke-autopilot'];
/** Where people start runners; Cloud Build is the other kind. */
export const STARTED_HOSTINGS = ['vm', 'kubernetes', 'local'] as const satisfies PoolHosting[];
export type StartedHosting = (typeof STARTED_HOSTINGS)[number];

export interface PoolDraft extends AutopilotDraft {
  name: string;
  kind: PoolKind;
  hosting: StartedHosting;
  location: string;
  min: string;
  max: string;
  accountId: string | null;
  region: string | null;
  image: string;
  machine: CloudBuildMachine;
  serviceAccount: string | null;
}

export const NEW_POOL: PoolDraft = {
  name: '',
  kind: 'start',
  hosting: 'vm',
  location: '',
  min: '0',
  max: '10',
  accountId: null,
  region: null,
  image: '',
  machine: 'default',
  serviceAccount: null,
  ...AUTOPILOT_DRAFT,
};

const STARTED = new Set<string>(STARTED_HOSTINGS);

const KIND_OF: Partial<Record<PoolHosting, PoolKind>> = {
  'cloud-build': 'cloud-build',
  'gke-autopilot': 'gke-autopilot',
};

export function draftOfPool(pool: RunnerPool): PoolDraft {
  const build = pool.cloudBuild;
  const autopilot = pool.autopilot;
  return {
    name: pool.name,
    kind: KIND_OF[pool.hosting] ?? 'start',
    hosting: STARTED.has(pool.hosting) ? (pool.hosting as StartedHosting) : 'vm',
    location: pool.location ?? '',
    min: String(pool.minRunners),
    max: String(pool.maxRunners),
    accountId: build?.account.id ?? autopilot?.account.id ?? null,
    region: build?.region ?? autopilot?.location ?? null,
    image: build?.image ?? autopilot?.image ?? '',
    machine: build?.machine ?? 'default',
    serviceAccount: build?.serviceAccount ?? autopilot?.serviceAccount ?? null,
    ...autopilotDraftOf(pool),
  };
}

export function cloudBuildOf(
  draft: PoolDraft,
  projects: readonly BuildProject[],
): CloudBuildPoolBody {
  return {
    account: draft.accountId ?? '',
    region: regionOfDraft(draft, projects).trim(),
    image: draft.image.trim(),
    machine: draft.machine,
    serviceAccount: serviceAccountOfDraft(draft, projects).trim(),
  };
}

/** Which Cloud Build field is wrong, so the dialog marks it; empty when all are right. */
export function cloudBuildProblems(
  draft: PoolDraft,
  projects: readonly BuildProject[],
): Array<'account' | 'region' | 'image' | 'serviceAccount'> {
  if (draft.kind !== 'cloud-build') return [];
  const parsed = cloudBuildPoolBodySchema.safeParse(cloudBuildOf(draft, projects));
  if (parsed.success) return [];
  const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  return (['account', 'region', 'image', 'serviceAccount'] as const).filter((field) =>
    fields.has(field),
  );
}

export function poolReady(draft: PoolDraft, projects: readonly BuildProject[]): boolean {
  const min = Number(draft.min);
  const max = Number(draft.max);
  const sizes =
    Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= Math.max(1, min);
  return (
    slugOf(draft.name).length > 0 &&
    sizes &&
    cloudBuildProblems(draft, projects).length === 0 &&
    autopilotProblems(draft, projects).length === 0
  );
}

export function createPoolBodyOf(
  draft: PoolDraft,
  projects: readonly BuildProject[],
): CreatePoolBody {
  const location = draft.location.trim();
  const sizes = { minRunners: Number(draft.min), maxRunners: Number(draft.max) };
  if (draft.kind === 'cloud-build') {
    return {
      key: slugOf(draft.name),
      name: draft.name.trim(),
      hosting: 'cloud-build',
      // Builds start per job, so a Cloud Build pool keeps no runners waiting.
      minRunners: 0,
      maxRunners: sizes.maxRunners,
      cloudBuild: cloudBuildOf(draft, projects),
    };
  }
  if (draft.kind === 'gke-autopilot') {
    return {
      key: slugOf(draft.name),
      name: draft.name.trim(),
      hosting: 'gke-autopilot',
      ...sizes,
      autopilot: autopilotBodyOf(draft, projects),
    };
  }
  return {
    key: slugOf(draft.name),
    name: draft.name.trim(),
    hosting: draft.hosting,
    ...(location ? { location } : {}),
    ...sizes,
  };
}

/** Only what changed; a switch to Cloud Build always carries its settings. */
export function updatePoolBodyOf(
  pool: RunnerPool,
  draft: PoolDraft,
  projects: readonly BuildProject[],
): UpdatePoolBody {
  const body: UpdatePoolBody = {};
  const hosting: PoolHosting = draft.kind === 'start' ? draft.hosting : draft.kind;
  if (hosting !== pool.hosting) body.hosting = hosting;
  if (draft.name.trim() !== pool.name) body.name = draft.name.trim();
  const max = Number(draft.max);
  if (max !== pool.maxRunners) body.maxRunners = max;
  if (draft.kind === 'cloud-build') {
    if (pool.minRunners !== 0) body.minRunners = 0;
    const next = cloudBuildOf(draft, projects);
    const now = pool.cloudBuild;
    const same =
      now &&
      now.account.id === next.account &&
      now.region === next.region &&
      now.image === next.image &&
      now.machine === next.machine &&
      now.serviceAccount === next.serviceAccount;
    if (!same) body.cloudBuild = next;
    return body;
  }
  const min = Number(draft.min);
  if (min !== pool.minRunners) body.minRunners = min;
  if (draft.kind === 'gke-autopilot') {
    const next = autopilotBodyOf(draft, projects);
    if (autopilotChanged(pool.autopilot, next)) body.autopilot = next;
    return body;
  }
  const location = draft.location.trim();
  if (location && location !== (pool.location ?? '')) body.location = location;
  return body;
}
