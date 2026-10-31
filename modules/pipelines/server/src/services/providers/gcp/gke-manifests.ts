import type { KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import type { ClusterGateway } from '../../../../../shared/clusters.ts';
import type { DeployVariable, ReleaseArtifact, ResolvedDeploySettings } from '../contract.ts';
import { imageOf } from './container.ts';
import { containerEnv, secretsOf, secretsVolume } from './gke-secrets.ts';
import { revisionIdOf } from './targets.ts';

/*
 * What a deploy on GKE writes: a namespace per catalog group, one Gateway there unless the
 * cluster's owners named their own, a Deployment and a Service per revision (with its
 * autoscaler and disruption budget, gke-scaling.ts), and one HTTPRoute per application whose
 * backend weights are the canary split. Each object is labelled with the application and
 * revision so pruning finds them again.
 */

export const LABELS = {
  application: 'app.kubernetes.io/name',
  managedBy: 'app.kubernetes.io/managed-by',
  revision: 'pipelines.bemmoly.dev/revision',
  release: 'pipelines.bemmoly.dev/release',
} as const;

export const MANAGED_BY = 'bemmoly-pipelines';
export const GATEWAY_NAME = 'bemmoly';
/** Google's global external Application Load Balancer, the one canary metrics come from. */
export const GATEWAY_CLASS = 'gke-l7-global-external-managed';
export const SERVICE_PORT = 80;
export const DEFAULT_CONTAINER_PORT = 8080;

/** The host an application's route answers on, until the front door gives it a domain. */
export const routeHostOf = (application: string, namespace: string) =>
  `${application}.${namespace}.bemmoly.internal`;

/**
 * "checkout-api-v1-43-0-a1c9e3f", as on Cloud Run. It names the Deployment and the Service, and
 * Service names must start with a letter while application keys may start with a digit.
 */
export function kubeRevisionOf(application: string, release: ReleaseArtifact): string {
  const revision = revisionIdOf(application, release);
  return /^[a-z]/.test(revision) ? revision : `r-${revision}`.slice(0, 63).replace(/-+$/, '');
}

export function namespaceManifest(namespace: string): KubernetesManifest {
  return {
    kind: 'Namespace',
    metadata: { name: namespace, labels: { [LABELS.managedBy]: MANAGED_BY } },
  };
}

export function gatewayManifest(namespace: string): KubernetesManifest {
  return {
    kind: 'Gateway',
    metadata: { name: GATEWAY_NAME, namespace, labels: { [LABELS.managedBy]: MANAGED_BY } },
    spec: {
      gatewayClassName: GATEWAY_CLASS,
      listeners: [
        {
          name: 'http',
          protocol: 'HTTP',
          port: 80,
          allowedRoutes: { namespaces: { from: 'Same' } },
        },
      ],
    },
  };
}

/** The labels every object of one revision carries. */
export const revisionLabels = (application: string, revision: string) => ({
  [LABELS.application]: application,
  [LABELS.managedBy]: MANAGED_BY,
  [LABELS.revision]: revision,
});

/**
 * `variables` are the whole environment when given; `serviceAccount` is who the pods run as,
 * named when they read secrets. `replicas` is left to the revision's autoscaler. The readiness
 * probe holds traffic until `ready` (or `path`) answers; the liveness probe restarts a pod
 * whose `path` stops answering.
 */
export function revisionManifests(input: {
  application: string;
  namespace: string;
  revision: string;
  release: ReleaseArtifact;
  settings: ResolvedDeploySettings;
  variables?: readonly DeployVariable[] | undefined;
  serviceAccount?: string | null;
}): { deployment: KubernetesManifest; service: KubernetesManifest } {
  const { application, namespace, revision, release, settings } = input;
  const port = settings.port ?? DEFAULT_CONTAINER_PORT;
  const labels = revisionLabels(application, revision);
  const limits = {
    ...(settings.resources.cpu !== null ? { cpu: settings.resources.cpu } : {}),
    ...(settings.resources.memory !== null ? { memory: settings.resources.memory } : {}),
  };
  const variables = input.variables ?? [];
  const env = containerEnv(variables, settings.secretsAs, revision);
  const mounted = settings.secretsAs === 'files' && secretsOf(variables).length > 0;
  const secrets = mounted ? secretsVolume(revision) : null;
  const { path, ready, timeoutSeconds } = settings.healthcheck;
  const probe = (at: string) => ({
    httpGet: { path: at, port },
    timeoutSeconds,
    periodSeconds: Math.max(10, timeoutSeconds),
  });
  const readiness = ready ?? path;
  const container = {
    name: application,
    image: imageOf(release),
    ports: [{ name: 'http', containerPort: port }],
    ...(env.length > 0 ? { env } : {}),
    ...(secrets ? { volumeMounts: [secrets.mount] } : {}),
    // Autopilot bills and schedules by requests, and sets limits equal to them.
    ...(Object.keys(limits).length > 0 ? { resources: { requests: limits, limits } } : {}),
    ...(readiness ? { readinessProbe: probe(readiness) } : {}),
    ...(path ? { livenessProbe: probe(path) } : {}),
  };
  return {
    deployment: {
      kind: 'Deployment',
      metadata: {
        name: revision,
        namespace,
        labels,
        annotations: { [LABELS.release]: release.version },
      },
      spec: {
        selector: { matchLabels: { [LABELS.revision]: revision } },
        template: {
          metadata: { labels },
          spec: {
            ...(input.serviceAccount ? { serviceAccountName: input.serviceAccount } : {}),
            containers: [container],
            ...(secrets ? { volumes: [secrets.volume] } : {}),
          },
        },
      },
    },
    service: {
      kind: 'Service',
      metadata: { name: revision, namespace, labels },
      spec: {
        type: 'ClusterIP',
        selector: { [LABELS.revision]: revision },
        ports: [{ name: 'http', port: SERVICE_PORT, targetPort: port }],
      },
    },
  };
}

export interface BackendWeight {
  revision: string;
  weight: number;
}

export function routeManifest(input: {
  application: string;
  namespace: string;
  gateway: ClusterGateway | null;
  backends: readonly BackendWeight[];
}): KubernetesManifest {
  const parent = input.gateway ?? { namespace: input.namespace, name: GATEWAY_NAME };
  return {
    kind: 'HTTPRoute',
    metadata: {
      name: input.application,
      namespace: input.namespace,
      labels: { [LABELS.application]: input.application, [LABELS.managedBy]: MANAGED_BY },
    },
    spec: {
      parentRefs: [{ name: parent.name, namespace: parent.namespace }],
      hostnames: [routeHostOf(input.application, input.namespace)],
      rules: [
        {
          backendRefs: input.backends.map((backend) => ({
            name: backend.revision,
            port: SERVICE_PORT,
            weight: backend.weight,
          })),
        },
      ],
    },
  };
}

/** The route's backends as revisions and weights, read back from the cluster. */
export function backendsOf(spec: Readonly<Record<string, unknown>> | undefined): BackendWeight[] {
  const rules = (spec?.['rules'] as Array<{ backendRefs?: unknown[] }> | undefined) ?? [];
  const refs = (rules[0]?.backendRefs ?? []) as Array<{ name?: string; weight?: number }>;
  return refs
    .filter((ref) => typeof ref.name === 'string')
    .map((ref) => ({ revision: ref.name ?? '', weight: ref.weight ?? 1 }));
}
