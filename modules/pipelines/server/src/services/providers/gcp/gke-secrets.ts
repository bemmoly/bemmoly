import { ValidationError } from '@bemmoly/shared';
import { secretManagerOn, type GkeCluster } from '../../../clients/gcp/index.ts';
import type { KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import type { DeployVariable } from '../contract.ts';
import type { GcpContext } from './context.ts';
import { grantSecretAccess } from './registry-secrets.ts';

/*
 * Secrets on GKE without a value ever passing through Pipelines or a Kubernetes Secret. Each
 * revision gets a SecretProviderClass naming its secrets pinned to their versions, and GKE's
 * Secret Manager add-on mounts them as files under /var/run/secrets/bemmoly/<NAME>. Kubernetes
 * cannot fill an environment variable from a file, so <NAME>_FILE holds each file's path. The
 * pods run as one Kubernetes service account per application, and that account's Workload
 * Identity principal is granted Secret Accessor on each secret, as Cloud Run's runtime is.
 */

export const SECRET_MOUNT = '/var/run/secrets/bemmoly';
export const SECRET_VOLUME = 'bemmoly-secrets';
export const SECRETS_DRIVER = 'secrets-store-gke.csi.k8s.io';

type SecretVariable = Extract<DeployVariable, { kind: 'secret' }>;

export const secretsOf = (variables: readonly DeployVariable[]) =>
  variables.filter((variable): variable is SecretVariable => variable.kind === 'secret');

/** The container's environment: plain values, and the file each secret is mounted at. */
export function containerEnv(variables: readonly DeployVariable[]) {
  const plain = variables.flatMap((variable) =>
    variable.kind === 'plain' ? [{ name: variable.name, value: variable.value }] : [],
  );
  const taken = new Set(plain.map((entry) => entry.name));
  const files = secretsOf(variables)
    .map((secret) => ({ name: `${secret.name}_FILE`, value: `${SECRET_MOUNT}/${secret.name}` }))
    .filter((entry) => !taken.has(entry.name));
  return [...plain, ...files].sort((a, b) => a.name.localeCompare(b.name));
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

/** Whether a Deployment mounts a SecretProviderClass, so pruning it removes that too. */
export function mountsSecrets(spec: Readonly<Record<string, unknown>> | undefined): boolean {
  const template = spec?.['template'] as
    { spec?: { volumes?: Array<{ csi?: unknown }> } } | undefined;
  return (template?.spec?.volumes ?? []).some((volume) => Boolean(volume.csi));
}

/** The sentence saying what to turn on before pods there can read secrets; null when ready. */
export function secretsProblem(cluster: GkeCluster, name: string, location: string): string | null {
  if (!cluster.workloadIdentityConfig.workloadPool) {
    return `Turn on Workload Identity on ${name} so applications there can read their secrets: gcloud container clusters update ${name} --location ${location} --workload-pool=PROJECT_ID.svc.id.goog`;
  }
  if (!secretManagerOn(cluster)) {
    return `Turn on the Secret Manager add-on on ${name} so applications there can read their secrets: gcloud container clusters update ${name} --location ${location} --enable-secret-manager`;
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

export function requireSecretsReady(cluster: GkeCluster, name: string, location: string): void {
  const problem = secretsProblem(cluster, name, location);
  if (problem) throw new ValidationError(problem);
}
