import { ValidationError } from '@bemmoly/shared';
import { secretManagerOn, secretSyncOn, type GkeCluster } from '../../../clients/gcp/index.ts';
import type { KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import type { SecretsAs } from '../../../../../shared/deploy-settings.ts';
import type { DeployVariable } from '../contract.ts';
import type { GcpContext } from './context.ts';
import { grantSecretAccess } from './registry-secrets.ts';

/*
 * Secrets on GKE without a value ever passing through Pipelines. Each revision gets a
 * SecretProviderClass naming its secrets pinned to their versions. As environment variables
 * (the default), a SecretSync has GKE's Secret Manager add-on copy them into a Kubernetes
 * Secret named after the revision, which each variable reads with secretKeyRef: a service
 * reading process.env.X works unchanged, and the value then lives in the cluster's etcd too.
 * As files, the add-on mounts them under /var/run/secrets/bemmoly/<NAME> and <NAME>_FILE holds
 * each path; the value then lives only in the pod's memory. The pods run as one Kubernetes
 * service account per application, whose Workload Identity principal is granted Secret
 * Accessor on each secret, and the sync reads as that same account.
 */

export const SECRET_MOUNT = '/var/run/secrets/bemmoly';
export const SECRET_VOLUME = 'bemmoly-secrets';
export const SECRETS_DRIVER = 'secrets-store-gke.csi.k8s.io';

type SecretVariable = Extract<DeployVariable, { kind: 'secret' }>;

export const secretsOf = (variables: readonly DeployVariable[]) =>
  variables.filter((variable): variable is SecretVariable => variable.kind === 'secret');

/**
 * The container's environment: plain values, and each secret read from the revision's synced
 * Secret, or as files, the path each one is mounted at.
 */
export function containerEnv(
  variables: readonly DeployVariable[],
  secretsAs: SecretsAs = 'files',
  revision = '',
) {
  const plain: Array<Record<string, unknown> & { name: string }> = variables.flatMap((variable) =>
    variable.kind === 'plain' ? [{ name: variable.name, value: variable.value }] : [],
  );
  const taken = new Set(plain.map((entry) => entry.name));
  const secrets = secretsOf(variables).map((secret) =>
    secretsAs === 'env'
      ? { name: secret.name, valueFrom: { secretKeyRef: { name: revision, key: secret.name } } }
      : { name: `${secret.name}_FILE`, value: `${SECRET_MOUNT}/${secret.name}` },
  );
  return [...plain, ...secrets.filter((entry) => !taken.has(entry.name))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Copies the revision's class into a Kubernetes Secret of the same name, key per variable. */
export function secretSyncManifest(input: {
  revision: string;
  namespace: string;
  labels: Readonly<Record<string, string>>;
  serviceAccount: string;
  secrets: readonly SecretVariable[];
}): KubernetesManifest {
  return {
    kind: 'SecretSync',
    metadata: { name: input.revision, namespace: input.namespace, labels: input.labels },
    spec: {
      serviceAccountName: input.serviceAccount,
      secretProviderClassName: input.revision,
      secretObject: {
        type: 'Opaque',
        data: input.secrets.map((secret) => ({ sourcePath: secret.name, targetKey: secret.name })),
      },
    },
  };
}

export function serviceAccountManifest(
  application: string,
  namespace: string,
  labels: Readonly<Record<string, string>>,
): KubernetesManifest {
  return { kind: 'ServiceAccount', metadata: { name: application, namespace, labels } };
}

/** One revision's secrets at their versions; a JSON string is a valid YAML string. */
export function secretClassManifest(input: {
  revision: string;
  namespace: string;
  labels: Readonly<Record<string, string>>;
  secrets: readonly SecretVariable[];
}): KubernetesManifest {
  const entries = input.secrets.map((secret) =>
    [
      `- resourceName: ${JSON.stringify(`projects/${secret.account}/secrets/${secret.secret}/versions/${secret.version}`)}`,
      `  path: ${JSON.stringify(secret.name)}`,
    ].join('\n'),
  );
  return {
    kind: 'SecretProviderClass',
    metadata: { name: input.revision, namespace: input.namespace, labels: input.labels },
    spec: { provider: 'gke', parameters: { secrets: `${entries.join('\n')}\n` } },
  };
}

/** The pod's volume and the container's mount for a revision's secrets. */
export function secretsVolume(revision: string) {
  return {
    volume: {
      name: SECRET_VOLUME,
      csi: {
        driver: SECRETS_DRIVER,
        readOnly: true,
        volumeAttributes: { secretProviderClass: revision },
      },
    },
    mount: { name: SECRET_VOLUME, mountPath: SECRET_MOUNT, readOnly: true },
  };
}

/** How a Deployment's secrets arrive, so pruning it removes what they came with. */
export function secretsModeOf(
  spec: Readonly<Record<string, unknown>> | undefined,
): SecretsAs | null {
  const template = spec?.['template'] as
    | {
        spec?: {
          volumes?: Array<{ csi?: unknown }>;
          containers?: Array<{ env?: Array<{ valueFrom?: { secretKeyRef?: unknown } }> }>;
        };
      }
    | undefined;
  if ((template?.spec?.volumes ?? []).some((volume) => Boolean(volume.csi))) return 'files';
  const env = template?.spec?.containers?.flatMap((container) => container.env ?? []) ?? [];
  return env.some((entry) => entry.valueFrom?.secretKeyRef) ? 'env' : null;
}

/** The sentence saying what to turn on before pods there can read secrets; null when ready. */
export function secretsProblem(
  cluster: GkeCluster,
  name: string,
  location: string,
  secretsAs: SecretsAs = 'files',
): string | null {
  if (!cluster.workloadIdentityConfig.workloadPool) {
    return `Turn on Workload Identity on ${name} so applications there can read their secrets: gcloud container clusters update ${name} --location ${location} --workload-pool=PROJECT_ID.svc.id.goog`;
  }
  if (!secretManagerOn(cluster)) {
    return `Turn on the Secret Manager add-on on ${name} so applications there can read their secrets: gcloud container clusters update ${name} --location ${location} --enable-secret-manager`;
  }
  if (secretsAs === 'env' && !secretSyncOn(cluster)) {
    return `Turn on secret sync on ${name} so applications there can read secrets as environment variables: gcloud container clusters update ${name} --location ${location} --enable-secret-sync. Or set secretsAs to files`;
  }
  return null;
}

/** "principal://…/subject/ns/shop/sa/checkout-api": the pods' identity in Google Cloud. */
export async function workloadPrincipal(
  context: GcpContext,
  projectId: string,
  namespace: string,
  serviceAccount: string,
): Promise<string> {
  const project = await context.control.resourceManager.getProject(projectId);
  const number = project?.name.split('/').pop();
  if (!number) {
    throw new ValidationError(
      `Pipelines cannot read ${projectId}, so it cannot name who the pods run as. Grant Bemmoly Browser on ${projectId}`,
    );
  }
  return `principal://iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${projectId}.svc.id.goog/subject/ns/${namespace}/sa/${serviceAccount}`;
}

/** Each secret readable by the pods' principal, as the control identity grants it. */
export async function grantPodSecrets(
  context: GcpContext,
  principal: string,
  secrets: readonly SecretVariable[],
): Promise<void> {
  for (const secret of secrets) {
    await grantSecretAccess(context.control.secretManager, {
      account: secret.account,
      name: secret.secret,
      principal,
    });
  }
}

export function requireSecretsReady(
  cluster: GkeCluster,
  name: string,
  location: string,
  secretsAs: SecretsAs = 'files',
): void {
  const problem = secretsProblem(cluster, name, location, secretsAs);
  if (problem) throw new ValidationError(problem);
}
