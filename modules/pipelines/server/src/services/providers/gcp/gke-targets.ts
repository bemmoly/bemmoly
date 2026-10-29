import { ConflictError } from '@bemmoly/shared';
import type { Health } from '../../../../../shared/common.ts';
import { KubernetesApiError, type KubernetesObject } from '../../../clients/kubernetes/index.ts';
import type { DeployVariable, TargetsPart } from '../contract.ts';
import type { GcpContexts } from './context.ts';
import type { GkeAccess, GkeHandle } from './gke-access.ts';
import {
  backendsOf,
  gatewayManifest,
  GATEWAY_NAME,
  kubeRevisionOf,
  LABELS,
  MANAGED_BY,
  namespaceManifest,
  revisionLabels,
  revisionManifests,
  routeManifest,
  type BackendWeight,
} from './gke-manifests.ts';
import {
  grantPodSecrets,
  mountsSecrets,
  requireSecretsReady,
  secretClassManifest,
  secretsOf,
  serviceAccountManifest,
  workloadPrincipal,
} from './gke-secrets.ts';

/*
 * GKE as a deploy target, the same four moves as Cloud Run. A deploy adds a Deployment and a
 * Service for the revision and puts it on the application's HTTPRoute at weight 0; shift and
 * roll back rewrite the route's weights, which is where the split lives (§19). Revisions that
 * take no traffic are pruned on each deploy, keeping the two newest to roll back to. Secrets
 * are mounted by GKE's Secret Manager add-on at the versions the deploy was given (gke-secrets).
 */

const IDLE_KEPT = 2;

type Opened = GkeHandle & {
  namespace: string;
  record: { gateway: { namespace: string; name: string } | null };
};

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
  await handle.kube.remove('Deployment', revision, handle.namespace);
  await handle.kube.remove('Service', revision, handle.namespace);
  if (mountsSecrets(deployment?.spec)) {
    await handle.kube.remove('SecretProviderClass', revision, handle.namespace);
  }
}

/**
 * A revision's secrets: the pods' service account, read access for its Workload Identity
 * principal, and the class naming each version. Answers who the pods run as, or null.
 */
async function mountSecrets(
  contexts: GcpContexts,
  handle: Opened & { record: { projectId: string; name: string; location: string } },
  input: { application: string; revision: string; variables: readonly DeployVariable[] },
  connection: Parameters<GcpContexts>[0],
): Promise<string | null> {
  const secrets = secretsOf(input.variables);
  if (secrets.length === 0) return null;
  requireSecretsReady(handle.cluster, handle.record.name, handle.record.location);
  const labels = revisionLabels(input.application, input.revision);
  await handle.kube.apply(
    serviceAccountManifest(input.application, handle.namespace, {
      [LABELS.application]: input.application,
      [LABELS.managedBy]: MANAGED_BY,
    }),
  );
  const principal = await workloadPrincipal(
    contexts(connection),
    handle.record.projectId,
    handle.namespace,
    input.application,
  );
  await grantPodSecrets(contexts(connection), principal, secrets);
  await handle.kube.apply(
    secretClassManifest({ revision: input.revision, namespace: handle.namespace, labels, secrets }),
  );
  return input.application;
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
      const revision = kubeRevisionOf(application, release);
      await ensureNamespace(handle);
      if (!handle.record.gateway) await handle.kube.apply(gatewayManifest(handle.namespace));
      const serviceAccount = await mountSecrets(
        contexts,
        handle,
        { application, revision, variables: variables ?? [] },
        target.connection,
      );
      const { deployment, service } = revisionManifests({
        application,
        namespace: handle.namespace,
        revision,
        release,
        variables,
        serviceAccount,
      });
      await handle.kube.apply(deployment);
      await handle.kube.apply(service);
      const current = await routeOf(handle, application);
      // A new route sends its (zero) traffic to the first revision, as Cloud Run does.
      let backends: BackendWeight[] = current ?? [{ revision, weight: 100 }];
      if (!backends.some((backend) => backend.revision === revision)) {
        backends = [...backends, { revision, weight: 0 }];
      }
      const serving = backends.filter((backend) => backend.weight > 0).map((b) => b.revision);
      const pruned = await idleRevisions(handle, application, new Set([revision, ...serving]));
      const prunedNames = pruned.map((old) => old.metadata.name);
      await writeRoute(
        handle,
        application,
        backends.filter((backend) => !prunedNames.includes(backend.revision)),
      );
      for (const old of pruned) await removeRevision(handle, old.metadata.name, old);
      return { revision };
    },

    async shift(target, input) {
      const handle = await access.target(target);
      const backends: BackendWeight[] = [{ revision: input.revision, weight: input.percent }];
      if (input.stable && input.percent < 100) {
        backends.push({ revision: input.stable, weight: 100 - input.percent });
      }
      await writeRoute(handle, target.application.key, backends);
    },

    async rollback(target, previousRevision) {
      const handle = await access.target(target);
      await writeRoute(handle, target.application.key, [
        { revision: previousRevision, weight: 100 },
      ]);
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
      // The owners' Gateway may sit where Pipelines may not read; only its own is looked up.
      const gateway = handle.record.gateway
        ? null
        : await handle.kube.get('Gateway', GATEWAY_NAME, handle.namespace);
      const addresses =
        (gateway?.status?.['addresses'] as Array<{ value?: string }> | undefined) ?? [];
      const address = addresses[0]?.value;
      return { traffic, url: address ? `http://${address}` : null };
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
