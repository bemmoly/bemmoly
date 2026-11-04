import {
  defaultRuntimeAccount,
  SECRETS_PERMISSIONS,
  SECRETS_ROLE_ID,
} from '../../../../../shared/grant-command.ts';
import { GcpApiError, type GcpClients } from '../../../clients/gcp/index.ts';
import type { AccountCheck, ConnectionRecord } from '../contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';

/*
 * Attaching a project that already exists (journeys proposal, attached mode). Before anything
 * deploys there, Pipelines checks, as the identity it will deploy as, that it can see the
 * project, that Cloud Run is on, and that it holds what a deploy needs, each on the resource
 * the grant command grants it on: Cloud Run on the project, Service Account User on the one
 * account services run as. Every gap becomes one sentence saying what to grant and where;
 * only the gaps that would stop a deploy fail the check.
 */

const DEPLOY_PERMISSIONS = [
  'run.services.get',
  'run.services.create',
  'run.services.update',
  'run.revisions.get',
  'run.revisions.delete',
];
const PUBLIC_PERMISSION = 'run.services.setIamPolicy';
const CANARY_PERMISSION = 'monitoring.timeSeries.list';
const BUILD_PERMISSIONS = ['cloudbuild.builds.create', 'cloudbuild.builds.get'];
const ACT_AS = 'iam.serviceAccounts.actAs';

const reasonOf = (error: unknown) =>
  error instanceof GcpApiError
    ? `Google Cloud answered ${error.status}: ${error.message}`
    : String(error);

const denied = (error: unknown) =>
  error instanceof GcpApiError && (error.status === 403 || error.status === 401);

async function projectName(clients: GcpClients, projectId: string, who: string) {
  try {
    const project = await clients.resourceManager.getProject(projectId);
    if (!project)
      return {
        name: null,
        number: null,
        problem: `Project ${projectId} does not exist; check the ID`,
      };
    if (project.state && project.state !== 'ACTIVE') {
      return {
        name: null,
        number: null,
        problem: `Project ${projectId} is ${project.state.toLowerCase()}, not active`,
      };
    }
    return {
      name: project.displayName ?? project.projectId,
      number: project.name.split('/').pop() ?? null,
      problem: null,
    };
  } catch (error) {
    if (denied(error)) {
      return {
        name: null,
        number: null,
        problem: `${who} cannot see project ${projectId}. Grant it Cloud Run Admin there`,
      };
    }
    return {
      name: null,
      number: null,
      problem: `Bemmoly could not read project ${projectId}. ${reasonOf(error)}`,
    };
  }
}

async function apiProblems(clients: GcpClients, projectId: string, impersonates: boolean) {
  let enabled: string[];
  try {
    enabled = await clients.serviceUsage.listEnabled(projectId);
  } catch (error) {
    // Listing APIs needs its own permission; a deploy then fails loudly if Cloud Run is off.
    const soft = denied(error) ? [] : [reasonOf(error)];
    return { critical: [], soft, services: undefined };
  }
  const missing = (api: string) => !enabled.includes(api);
  const services = {
    run: !missing('run.googleapis.com'),
    build: !missing('cloudbuild.googleapis.com'),
    secrets: !missing('secretmanager.googleapis.com'),
  };
  const critical = missing('run.googleapis.com')
    ? [`Turn on the Cloud Run Admin API in ${projectId}`]
    : [];
  if (impersonates && missing('iamcredentials.googleapis.com')) {
    critical.push(`Turn on the IAM Service Account Credentials API in ${projectId}`);
  }
  const soft = missing('monitoring.googleapis.com')
    ? [`Turn on the Cloud Monitoring API in ${projectId} so canaries can read error rates`]
    : [];
  if (!services.build)
    soft.push(`Turn on the Cloud Build API in ${projectId} so jobs can run there`);
  if (!services.secrets) {
    soft.push(`Turn on the Secret Manager API in ${projectId} so secrets can live there`);
  }
  return { critical, soft, services };
}

/** Whether the deploy identity may start services that run as `runtime`, asked of it. */
async function actAsProblem(clients: GcpClients, projectId: string, runtime: string, who: string) {
  const grant = `Grant ${who} Service Account User on ${runtime}, the account services in ${projectId} run as`;
  try {
    const held = await clients.iam.testServiceAccountPermissions(runtime, [ACT_AS]);
    return held.includes(ACT_AS) ? null : grant;
  } catch (error) {
    if (error instanceof GcpApiError && error.status === 404) {
      return `${runtime}, the account services in ${projectId} run as, does not exist. Name the runtime account when you attach ${projectId}, or create it`;
    }
    if (denied(error)) return grant;
    throw error;
  }
}

interface Holders {
  deploy: GcpClients;
  /** Secret Manager calls are made by the connection's own identity, never a deployer. */
  secrets: GcpClients;
  who: string;
  secretsWho: string;
}

async function permissionProblems(holders: Holders, projectId: string, runtime: string | null) {
  const { who } = holders;
  const same = holders.deploy === holders.secrets;
  const wanted = [
    ...DEPLOY_PERMISSIONS,
    PUBLIC_PERMISSION,
    CANARY_PERMISSION,
    ...BUILD_PERMISSIONS,
    ...(same ? SECRETS_PERMISSIONS : []),
  ];
  const resource = `projects/${projectId}`;
  const held = await holders.deploy.resourceManager.testPermissions(resource, wanted);
  const secretsHeld = same
    ? held
    : await holders.secrets.resourceManager.testPermissions(resource, [...SECRETS_PERMISSIONS]);
  const lacks = (permission: string) => !held.includes(permission);
  const critical: string[] = [];
  const soft: string[] = [];
  if (DEPLOY_PERMISSIONS.some(lacks)) {
    critical.push(`Grant ${who} Cloud Run Admin on ${projectId}`);
  } else if (lacks(PUBLIC_PERMISSION)) {
    soft.push(
      `Grant ${who} Cloud Run Admin on ${projectId} so services marked public can be reached; Cloud Run Developer cannot open a service to everyone`,
    );
  }
  const actAs = runtime ? await actAsProblem(holders.deploy, projectId, runtime, who) : null;
  if (actAs) critical.push(actAs);
  if (lacks(CANARY_PERMISSION)) {
    soft.push(`Grant ${who} Monitoring Viewer on ${projectId} so canaries can read error rates`);
  }
  if (BUILD_PERMISSIONS.some(lacks)) {
    soft.push(`Grant ${who} Cloud Build Editor on ${projectId} so jobs can run there`);
  }
  if (SECRETS_PERMISSIONS.some((permission) => !secretsHeld.includes(permission))) {
    soft.push(
      `Grant ${holders.secretsWho} the role projects/${projectId}/roles/${SECRETS_ROLE_ID} (the grant command creates it, holding ${SECRETS_PERMISSIONS.join(', ')}) so secrets can live there`,
    );
  }
  return { critical, soft };
}

export function createAttachCheck(contexts: GcpContexts) {
  return async function verifyAccount(
    connection: ConnectionRecord,
    account: { externalId: string; config: Readonly<Record<string, unknown>> },
  ): Promise<AccountCheck> {
    const context = contexts(connection);
    const config = accountConfigOf(account.config);
    const projectId = account.externalId;
    const impersonates = Boolean(config.deployerServiceAccount);
    const principal = (await context.principal().catch(() => null)) ?? 'Bemmoly';
    const who = config.deployerServiceAccount ?? principal;
    const clients = context.deployer(projectId, config);
    try {
      const project = await projectName(clients, projectId, who);
      if (project.problem) return { ok: false, name: null, problems: [project.problem] };
      const runtime =
        config.runtimeServiceAccount ??
        (project.number ? defaultRuntimeAccount(project.number) : null);
      const apis = await apiProblems(clients, projectId, impersonates);
      const holders = { deploy: clients, secrets: context.control, who, secretsWho: principal };
      const permissions = await permissionProblems(holders, projectId, runtime);
      const critical = [...apis.critical, ...permissions.critical];
      return {
        ok: critical.length === 0,
        name: project.name,
        problems: [...critical, ...apis.soft, ...permissions.soft],
        ...(apis.services ? { services: apis.services } : {}),
      };
    } catch (error) {
      if (impersonates && denied(error)) {
        return {
          ok: false,
          name: null,
          problems: [
            `Bemmoly cannot act as ${config.deployerServiceAccount}. Grant it Service Account Token Creator on that account`,
          ],
        };
      }
      return {
        ok: false,
        name: null,
        problems: [`Bemmoly could not check ${projectId}. ${reasonOf(error)}`],
      };
    }
  };
}
