import { ConflictError } from '@bemmoly/shared';
import type { Health } from '../../../../../shared/common.ts';
import { KubernetesApiError, type KubernetesObject } from '../../../clients/kubernetes/index.ts';
import { settingsOf } from '../../deploy-settings/resolve.ts';
import type { TargetsPart } from '../contract.ts';
import type { GcpContexts } from './context.ts';
import type { GkeAccess } from './gke-access.ts';
import {
  backendsOf,
  DEFAULT_CONTAINER_PORT,
  gatewayManifest,
  kubeRevisionOf,
  LABELS,
  MANAGED_BY,
  namespaceManifest,
  revisionManifests,
  routeManifest,
  type BackendWeight,
} from './gke-manifests.ts';
import { clusterUrlOf, removeRevisionObjects, stableServiceManifest } from './gke-scaling.ts';

/*
 * GKE as a deploy target, the same four moves as Cloud Run. A deploy adds a Deployment and a
 * Service for the revision and puts it on the application's HTTPRoute at weight 0; shift and
 * roll back rewrite the route's weights, which is where the split lives (§19). Revisions that
 * take no traffic are pruned on each deploy, keeping the two newest to roll back to. Secrets
 * reach pods through GKE's Secret Manager add-on at the versions the deploy was given, synced
 * into a Secret or mounted as files (gke-secrets). Each revision scales on its own autoscaler,
 * and the application's stable Service follows the revision taking most traffic (gke-scaling).
 */

const IDLE_KEPT = 2;

import {
  applyScaling,
  followHeaviest,
  gatewayUrl,
  mountSecrets,
  type Opened,
} from './gke-steps.ts';

const selectorOf = (application: string) =>
  `${LABELS.application}=${application},${LABELS.managedBy}=${MANAGED_BY}`;

async function ensureNamespace(handle: Opened): Promise<void> {
  // An attached cluster's owners may have made the namespace and granted nothing wider;
  // only a missing one is applied, and a refused read still tries the apply.
  let exists = false;
  try {
    exists = (await handle.kube.get('Namespace', handle.namespace)) !== null;
  } catch (error) {
    if (!(error instanceof KubernetesApiError && error.status === 403)) throw error;
  }
  if (!exists) await handle.kube.apply(namespaceManifest(handle.namespace));
}

async function routeOf(handle: Opened, application: string): Promise<BackendWeight[] | null> {
  const route = await handle.kube.get('HTTPRoute', application, handle.namespace);
  return route ? backendsOf(route.spec) : null;
}

async function writeRoute(handle: Opened, application: string, backends: BackendWeight[]) {
  await handle.kube.apply(
    routeManifest({
      application,
      namespace: handle.namespace,
      gateway: handle.record.gateway,
      backends,
    }),
  );
}

/** Revisions past the newest few that take no traffic, oldest last. */
async function idleRevisions(
  handle: Opened,
  application: string,
  keep: ReadonlySet<string>,
): Promise<KubernetesObject[]> {
  const deployments = await handle.kube.list(
    'Deployment',
    handle.namespace,
    selectorOf(application),
  );
  return deployments
    .filter((deployment) => !keep.has(deployment.metadata.name))
    .sort((a, b) =>
      (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''),
    )
    .slice(IDLE_KEPT);
}

async function removeRevision(
  handle: Opened,
  revision: string,
  deployment: KubernetesObject | null,
) {
  await removeRevisionObjects(handle.kube, handle.namespace, revision, deployment?.spec);
}

function healthOf(status: Readonly<Record<string, unknown>> | undefined, replicas: number): Health {
  const conditions = (status?.['conditions'] as Array<Record<string, string>> | undefined) ?? [];
  const condition = (type: string) => conditions.find((entry) => entry['type'] === type);
  if (condition('Progressing')?.['status'] === 'False') return 'failing';
  if (condition('ReplicaFailure')?.['status'] === 'True') return 'failing';
  if (condition('Available')?.['status'] !== 'True') return 'unknown';
  const ready = Number(status?.['readyReplicas'] ?? 0);
  return ready >= replicas ? 'healthy' : 'degraded';
}

export function createGkeTargets(contexts: GcpContexts, access: GkeAccess): TargetsPart {
  return {
    kinds: ['container-service', 'kubernetes'],

    async deploy(target, release, variables) {
      const handle = await access.target(target);
      const application = target.application.key;
      const settings = settingsOf(release, target);
      const revision = kubeRevisionOf(application, release);
      await ensureNamespace(handle);
      if (!handle.record.gateway) await handle.kube.apply(gatewayManifest(handle.namespace));
      const serviceAccount = await mountSecrets(
        contexts,
        handle,
        { application, revision, variables: variables ?? [], secretsAs: settings.secretsAs },
        target.connection,
      );
      const { deployment, service } = revisionManifests({
        application,
        namespace: handle.namespace,
        revision,
        release,
        settings,
        variables,
        serviceAccount,
      });
      await handle.kube.apply(deployment);
      await handle.kube.apply(service);
      await applyScaling(handle, revision, application, settings);
      const current = await routeOf(handle, application);
      // A new route sends its (zero) traffic to the first revision, as Cloud Run does.
      let backends: BackendWeight[] = current ?? [{ revision, weight: 100 }];
      if (!backends.some((backend) => backend.revision === revision)) {
        backends = [...backends, { revision, weight: 0 }];
      }
      const serving = backends.filter((backend) => backend.weight > 0).map((b) => b.revision);
      const pruned = await idleRevisions(handle, application, new Set([revision, ...serving]));
      const prunedNames = pruned.map((old) => old.metadata.name);
      const kept = backends.filter((backend) => !prunedNames.includes(backend.revision));
      await writeRoute(handle, application, kept);
      const port = settings.port ?? DEFAULT_CONTAINER_PORT;
      const heaviest = [...kept].sort((a, b) => b.weight - a.weight)[0]?.revision ?? revision;
      await handle.kube.apply(
        stableServiceManifest({
          application,
          namespace: handle.namespace,
          revision: heaviest,
          port,
        }),
      );
      for (const old of pruned) await removeRevision(handle, old.metadata.name, old);
      return {
        revision,
        address: {
          url: clusterUrlOf(application, handle.namespace, port),
          publicUrl: await gatewayUrl(handle),
        },
      };
    },

    async shift(target, input) {
      const handle = await access.target(target);
      const backends: BackendWeight[] = [{ revision: input.revision, weight: input.percent }];
      if (input.stable && input.percent < 100) {
        backends.push({ revision: input.stable, weight: 100 - input.percent });
      }
      await writeRoute(handle, target.application.key, backends);
      await followHeaviest(handle, target.application.key, backends);
    },

    async rollback(target, previousRevision) {
      const handle = await access.target(target);
      const backends = [{ revision: previousRevision, weight: 100 }];
      await writeRoute(handle, target.application.key, backends);
      await followHeaviest(handle, target.application.key, backends);
    },

    async health(target, revision) {
      const handle = await access.target(target);
      const found = await handle.kube.get('Deployment', revision, handle.namespace);
      if (!found) return 'unknown';
      return healthOf(found.status, Number(found.spec?.['replicas'] ?? 1));
    },

    async describe(target) {
      const handle = await access.target(target);
      const backends = (await routeOf(handle, target.application.key)) ?? [];
      const total = backends.reduce((sum, backend) => sum + backend.weight, 0);
      const traffic = backends
        .filter((backend) => backend.weight > 0 && total > 0)
        .map((backend) => ({
          revision: backend.revision,
          percent: Math.round((backend.weight * 100) / total),
        }))
        .sort((a, b) => b.percent - a.percent);
      return { traffic, url: await gatewayUrl(handle) };
    },

    async retire(target, revision) {
      const handle = await access.target(target);
      const application = target.application.key;
      const backends = (await routeOf(handle, application)) ?? [];
      const serving = backends.find((backend) => backend.revision === revision);
      if ((serving?.weight ?? 0) > 0) {
        throw new ConflictError(`${revision} still takes traffic`);
      }
      if (serving) {
        await writeRoute(
          handle,
          application,
          backends.filter((backend) => backend.revision !== revision),
        );
      }
      const deployment = await handle.kube.get('Deployment', revision, handle.namespace);
      await removeRevision(handle, revision, deployment);
    },
  };
}
