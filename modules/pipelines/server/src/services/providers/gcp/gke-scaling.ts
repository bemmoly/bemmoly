import type { KubernetesClient, KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import type { ResolvedDeploySettings } from '../contract.ts';
import { DEFAULT_CONTAINER_PORT, LABELS, MANAGED_BY } from './gke-manifests.ts';
import { secretsModeOf } from './gke-secrets.ts';

/*
 * How many pods a revision runs and how it reaches its callers. Each revision's Deployment
 * leaves `replicas` to a HorizontalPodAutoscaler, so a canary at 5% and the revision taking
 * the rest each scale on their own CPU between the same min and max; idle revisions kept for
 * a roll back keep their min too. From two replicas up a PodDisruptionBudget lets one go at
 * a time, so an Autopilot upgrade never drains them all. One stable Service per application
 * gives callers in the cluster a name that outlives revisions; it selects the revision taking
 * most traffic, since the canary's weights live on the Gateway, not inside the cluster.
 */

/** The stable Service's name: the application's key, which must start with a letter there. */
export const stableServiceOf = (application: string) =>
  /^[a-z]/.test(application) ? application : `app-${application}`.slice(0, 63);

/** "http://cart-api.checkout.svc.cluster.local:8080": what services in the cluster call. */
export const clusterUrlOf = (application: string, namespace: string, port: number) =>
  `http://${stableServiceOf(application)}.${namespace}.svc.cluster.local:${port}`;

export function autoscalerManifest(input: {
  revision: string;
  namespace: string;
  labels: Readonly<Record<string, string>>;
  settings: ResolvedDeploySettings;
}): KubernetesManifest {
  const { min, max, cpuTarget } = input.settings.scaling;
  return {
    kind: 'HorizontalPodAutoscaler',
    metadata: { name: input.revision, namespace: input.namespace, labels: input.labels },
    spec: {
      scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: input.revision },
      // An autoscaler cannot hold a Deployment at zero; one is its floor.
      minReplicas: Math.max(1, min),
      maxReplicas: Math.max(1, min, max ?? 1),
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: { type: 'Utilization', averageUtilization: cpuTarget ?? 70 },
          },
        },
      ],
    },
  };
}

/** Null when the revision runs too few pods for a budget to mean anything. */
export function disruptionBudgetManifest(input: {
  revision: string;
  namespace: string;
  labels: Readonly<Record<string, string>>;
  settings: ResolvedDeploySettings;
}): KubernetesManifest | null {
  if (input.settings.maxUnavailable === null) return null;
  return {
    kind: 'PodDisruptionBudget',
    metadata: { name: input.revision, namespace: input.namespace, labels: input.labels },
    spec: {
      maxUnavailable: input.settings.maxUnavailable,
      selector: { matchLabels: { [LABELS.revision]: input.revision } },
    },
  };
}

export function stableServiceManifest(input: {
  application: string;
  namespace: string;
  revision: string;
  port: number;
}): KubernetesManifest {
  return {
    kind: 'Service',
    metadata: {
      name: stableServiceOf(input.application),
      namespace: input.namespace,
      labels: { [LABELS.application]: input.application, [LABELS.managedBy]: MANAGED_BY },
    },
    spec: {
      type: 'ClusterIP',
      selector: { [LABELS.revision]: input.revision },
      ports: [{ name: 'http', port: input.port, targetPort: input.port }],
    },
  };
}

/** The port a revision's container listens on, read back from its Deployment. */
export function containerPortOf(spec: Readonly<Record<string, unknown>> | undefined): number {
  const template = spec?.['template'] as
    { spec?: { containers?: Array<{ ports?: Array<{ containerPort?: number }> }> } } | undefined;
  return template?.spec?.containers?.[0]?.ports?.[0]?.containerPort ?? DEFAULT_CONTAINER_PORT;
}

/** Everything one revision is made of; gone already counts as removed. */
export async function removeRevisionObjects(
  kube: Pick<KubernetesClient, 'remove'>,
  namespace: string,
  revision: string,
  deploymentSpec: Readonly<Record<string, unknown>> | undefined,
): Promise<void> {
  await kube.remove('Deployment', revision, namespace);
  await kube.remove('Service', revision, namespace);
  await kube.remove('HorizontalPodAutoscaler', revision, namespace);
  await kube.remove('PodDisruptionBudget', revision, namespace);
  const secrets = secretsModeOf(deploymentSpec);
  if (secrets === 'env') await kube.remove('SecretSync', revision, namespace);
  if (secrets) await kube.remove('SecretProviderClass', revision, namespace);
}
