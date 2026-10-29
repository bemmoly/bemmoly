import type { KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import type { ClusterGateway } from '../../../../../shared/clusters.ts';
import type { ReleaseArtifact } from '../contract.ts';
import { deploySettingsOf, imageOf } from './container.ts';
import { revisionIdOf } from './targets.ts';

/*
 * What a deploy on GKE writes: a namespace per catalog group, one Gateway there unless the
 * cluster's owners named their own, a Deployment and a Service per revision, and one
 * HTTPRoute per application whose backend weights are the canary split. Each object is
 * labelled with the application and revision so pruning finds them again.
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
const DEFAULT_CONTAINER_PORT = 8080;

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

const portOf = (value: unknown): number => {
  const port = typeof value === 'string' ? Number(value) : value;
  return typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536
    ? port
    : DEFAULT_CONTAINER_PORT;
};

/** Plain variables a release carries; secret references are mounted by their own stream. */
function variablesOf(release: ReleaseArtifact): Array<{ name: string; value: string }> {
  const raw = release.resolvedConfig['variables'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string | number | boolean] =>
      ['string', 'number', 'boolean'].includes(typeof entry[1]),
    )
    .map(([name, value]) => ({ name, value: String(value) }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

export function revisionManifests(input: {
  application: string;
  namespace: string;
  revision: string;
  release: ReleaseArtifact;
}): { deployment: KubernetesManifest; service: KubernetesManifest } {
  const { application, namespace, revision, release } = input;
  const settings = deploySettingsOf(release);
  const port = portOf(settings.port);
  const labels = {
    [LABELS.application]: application,
    [LABELS.managedBy]: MANAGED_BY,
    [LABELS.revision]: revision,
  };
  const limits = {
    ...(settings.resources?.cpu !== undefined ? { cpu: String(settings.resources.cpu) } : {}),
    ...(settings.resources?.memory ? { memory: settings.resources.memory } : {}),
  };
  const env = variablesOf(release);
  const container = {
    name: application,
    image: imageOf(release),
    ports: [{ name: 'http', containerPort: port }],
    ...(env.length > 0 ? { env } : {}),
    // Autopilot bills and schedules by requests, and sets limits equal to them.
    ...(Object.keys(limits).length > 0 ? { resources: { requests: limits, limits } } : {}),
    ...(settings.healthcheck
      ? {
          readinessProbe: {
            httpGet: { path: settings.healthcheck.path, port },
            timeoutSeconds: settings.healthcheck.timeoutSeconds,
            periodSeconds: Math.max(10, settings.healthcheck.timeoutSeconds),
          },
        }
      : {}),
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
        replicas: 1,
        selector: { matchLabels: { [LABELS.revision]: revision } },
        template: { metadata: { labels }, spec: { containers: [container] } },
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
