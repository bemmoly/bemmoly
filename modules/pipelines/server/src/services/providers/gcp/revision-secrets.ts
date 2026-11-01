import { ValidationError } from '@bemmoly/shared';
import type { DeployVariable } from '../contract.ts';
import type { GcpContext } from './context.ts';
import { grantSecretAccess } from './registry-secrets.ts';

/*
 * What a revision needs before it starts with secrets: whoever it runs as may read each one.
 * A project attached without a runtime account runs services as Compute Engine's default
 * account, PROJECT_NUMBER-compute@developer.gserviceaccount.com, so that is who is granted.
 */

type SecretVariable = Extract<DeployVariable, { kind: 'secret' }>;

/** Who a service in this project runs as when Pipelines names no account. */
export async function defaultRuntimeAccount(context: GcpContext, projectId: string) {
  const project = await context.control.resourceManager.getProject(projectId);
  const number = project?.name.split('/').pop();
  if (!number) {
    throw new ValidationError(
      `Pipelines cannot read ${projectId}, so it cannot tell who the service runs as. Grant Bemmoly Browser on ${projectId}, or name a runtime account when you attach it`,
    );
  }
  return `${number}-compute@developer.gserviceaccount.com`;
}

/** The variables' secrets, readable by `runtime` (or the project's default account). */
export async function grantRevisionSecrets(
  context: GcpContext,
  projectId: string,
  runtime: string | null,
  variables: readonly DeployVariable[],
): Promise<void> {
  const secrets = variables.filter((v): v is SecretVariable => v.kind === 'secret');
  if (secrets.length === 0) return;
  const principal = runtime ?? (await defaultRuntimeAccount(context, projectId));
  for (const secret of secrets) {
    await grantSecretAccess(context.control.secretManager, {
      account: secret.account,
      name: secret.secret,
      principal,
    });
  }
}

/** Cloud Run's env list: plain values inline, secrets pinned to the recorded version. */
export function envOf(projectId: string, variables: readonly DeployVariable[]) {
  return variables.map((variable) =>
    variable.kind === 'plain'
      ? { name: variable.name, value: variable.value }
      : {
          name: variable.name,
          valueSource: {
            secretKeyRef: {
              // Another project's secret needs its full name; this project's takes the short one.
              secret:
                variable.account === projectId
                  ? variable.secret
                  : `projects/${variable.account}/secrets/${variable.secret}`,
              version: variable.version,
            },
          },
        },
  );
}

/** Where a secret's file sits when secrets arrive as files: one directory per secret. */
export const SECRET_FILES = '/var/run/secrets/bemmoly';

const volumeOf = (name: string) =>
  `secret-${name.toLowerCase().replace(/_/g, '-')}`.slice(0, 63).replace(/-+$/, '');

/**
 * Secrets as files on Cloud Run: each pinned version in its own volume, mounted at
 * /var/run/secrets/bemmoly/<NAME>/<NAME>, with <NAME>_FILE in the environment saying where.
 * Cloud Run mounts one secret per directory, so the file sits one level down.
 */
export function filesOf(projectId: string, variables: readonly DeployVariable[]) {
  const secrets = variables.filter((v): v is SecretVariable => v.kind === 'secret');
  const plain = variables.flatMap((v) =>
    v.kind === 'plain' ? [{ name: v.name, value: v.value }] : [],
  );
  const taken = new Set(plain.map((entry) => entry.name));
  const pointers = secrets
    .map((secret) => ({
      name: `${secret.name}_FILE`,
      value: `${SECRET_FILES}/${secret.name}/${secret.name}`,
    }))
    .filter((entry) => !taken.has(entry.name));
  return {
    env: [...plain, ...pointers],
    volumes: secrets.map((secret) => ({
      name: volumeOf(secret.name),
      secret: {
        secret:
          secret.account === projectId
            ? secret.secret
            : `projects/${secret.account}/secrets/${secret.secret}`,
        items: [{ path: secret.name, version: secret.version }],
      },
    })),
    mounts: secrets.map((secret) => ({
      name: volumeOf(secret.name),
      mountPath: `${SECRET_FILES}/${secret.name}`,
    })),
  };
}
