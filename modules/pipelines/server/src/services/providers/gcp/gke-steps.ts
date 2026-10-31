import type { SecretsAs } from '../../../../../shared/deploy-settings.ts';
import type { DeployVariable, ResolvedDeploySettings } from '../contract.ts';
import type { GcpContexts } from './context.ts';
import type { GkeHandle } from './gke-access.ts';
import {
  DEFAULT_CONTAINER_PORT,
  GATEWAY_NAME,
  LABELS,
  MANAGED_BY,
  revisionLabels,
  type BackendWeight,
} from './gke-manifests.ts';
import {
  autoscalerManifest,
  disruptionBudgetManifest,
  stableServiceManifest,
  stableServiceOf,
} from './gke-scaling.ts';
import {
  grantPodSecrets,
  requireSecretsReady,
  secretClassManifest,
  secretsOf,
  secretSyncManifest,
  serviceAccountManifest,
  workloadPrincipal,
} from './gke-secrets.ts';

/*
 * The steps a GKE deploy, shift and roll back share beyond the route (gke-targets.ts): a
 * revision's secrets and scaling, the stable Service, and the Gateway's address.
 */

export type Opened = GkeHandle & {
  namespace: string;
  record: { gateway: { namespace: string; name: string } | null };
};

/** Points the stable Service at the revision taking most traffic, keeping its port. */
export async function followHeaviest(
  handle: Opened,
  application: string,
  backends: BackendWeight[],
) {
  const heaviest = [...backends].sort((a, b) => b.weight - a.weight)[0];
  if (!heaviest) return;
  const current = await handle.kube.get('Service', stableServiceOf(application), handle.namespace);
  if (!current) return;
  const ports = (current.spec?.['ports'] as Array<{ port?: number }> | undefined) ?? [];
  await handle.kube.apply(
    stableServiceManifest({
      application,
      namespace: handle.namespace,
      revision: heaviest.revision,
      port: ports[0]?.port ?? DEFAULT_CONTAINER_PORT,
    }),
  );
}

/**
 * A revision's secrets: the pods' service account, read access for its Workload Identity
 * principal, and the class naming each version. Answers who the pods run as, or null.
 */
export async function mountSecrets(
  contexts: GcpContexts,
  handle: Opened & { record: { projectId: string; name: string; location: string } },
  input: {
    application: string;
    revision: string;
    variables: readonly DeployVariable[];
    secretsAs: SecretsAs;
  },
  connection: Parameters<GcpContexts>[0],
): Promise<string | null> {
  const secrets = secretsOf(input.variables);
  if (secrets.length === 0) return null;
  requireSecretsReady(handle.cluster, handle.record.name, handle.record.location, input.secretsAs);
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
  if (input.secretsAs === 'env') {
    await handle.kube.apply(
      secretSyncManifest({
        revision: input.revision,
        namespace: handle.namespace,
        labels,
        serviceAccount: input.application,
        secrets,
      }),
    );
  }
  return input.application;
}

/** The revision's autoscaler, and its disruption budget when it runs two pods or more. */
export async function applyScaling(
  handle: Opened,
  revision: string,
  application: string,
  settings: ResolvedDeploySettings,
) {
  const input = {
    revision,
    namespace: handle.namespace,
    labels: revisionLabels(application, revision),
    settings,
  };
  await handle.kube.apply(autoscalerManifest(input));
  const budget = disruptionBudgetManifest(input);
  if (budget) await handle.kube.apply(budget);
}

/** The Gateway's address; the owners' Gateway may sit where Pipelines may not read. */
export async function gatewayUrl(handle: Opened): Promise<string | null> {
  if (handle.record.gateway) return null;
  const gateway = await handle.kube.get('Gateway', GATEWAY_NAME, handle.namespace);
  const addresses = (gateway?.status?.['addresses'] as Array<{ value?: string }> | undefined) ?? [];
  const address = addresses[0]?.value;
  return address ? `http://${address}` : null;
}
