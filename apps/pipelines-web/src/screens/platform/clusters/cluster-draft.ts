import {
  clusterLocationSchema,
  clusterNameSchema,
  projectIdSchema,
  slugSchema,
  type ClusterBody,
  type ClusterMode,
  type CloudConnection,
  type Environment,
} from '@bemmoly/module-pipelines/shared';

/*
 * The Create and Attach a cluster dialogs' rules, apart from their drawing. A field left as
 * null shows its default: the name follows the environment, the project is the environment's
 * own and the location its region. A Gateway is named with both its namespace and its name,
 * or not at all.
 */

export interface ClusterDraft {
  mode: ClusterMode;
  name: string | null;
  projectId: string | null;
  location: string | null;
  gatewayNamespace: string;
  gatewayName: string;
}

export const NEW_CLUSTER: ClusterDraft = {
  mode: 'autopilot',
  name: null,
  projectId: null,
  location: null,
  gatewayNamespace: '',
  gatewayName: '',
};

export type ClusterField = 'name' | 'projectId' | 'location' | 'gateway';

export interface ClusterDefaults {
  name: string;
  projectId: string;
  location: string;
}

export function clusterDefaults(
  environment: Pick<Environment, 'key' | 'region' | 'cloudAccount'>,
  connection: Pick<CloudConnection, 'region'> | null,
): ClusterDefaults {
  return {
    name: `bemmoly-${environment.key}`.slice(0, 40).replace(/-+$/, ''),
    projectId: environment.cloudAccount?.externalId ?? '',
    location: environment.region ?? connection?.region ?? 'us-central1',
  };
}

/** What each field shows: what was typed, else its default. */
export const shownOf = (draft: ClusterDraft, defaults: ClusterDefaults) => ({
  name: draft.name ?? defaults.name,
  projectId: draft.projectId ?? defaults.projectId,
  location: draft.location ?? defaults.location,
});

export function clusterProblems(
  draft: ClusterDraft,
  defaults: ClusterDefaults,
  attaching: boolean,
): Set<ClusterField> {
  const shown = shownOf(draft, defaults);
  const problems = new Set<ClusterField>();
  if (!clusterNameSchema.safeParse(shown.name).success) problems.add('name');
  if (!attaching) return problems;
  if (!projectIdSchema.safeParse(shown.projectId).success) problems.add('projectId');
  if (!clusterLocationSchema.safeParse(shown.location).success) problems.add('location');
  const namespace = draft.gatewayNamespace.trim();
  const name = draft.gatewayName.trim();
  if (Boolean(namespace) !== Boolean(name)) problems.add('gateway');
  else if (
    namespace &&
    !(slugSchema.safeParse(namespace).success && slugSchema.safeParse(name).success)
  ) {
    problems.add('gateway');
  }
  return problems;
}

export function clusterBodyOf(
  draft: ClusterDraft,
  defaults: ClusterDefaults,
  environmentId: string,
  attaching: boolean,
): ClusterBody {
  const shown = shownOf(draft, defaults);
  if (!attaching) {
    return { origin: 'created', environmentId, mode: draft.mode, name: shown.name };
  }
  const namespace = draft.gatewayNamespace.trim();
  return {
    origin: 'attached',
    environmentId,
    projectId: shown.projectId,
    location: shown.location,
    name: shown.name,
    gateway: namespace ? { namespace, name: draft.gatewayName.trim() } : null,
  };
}
