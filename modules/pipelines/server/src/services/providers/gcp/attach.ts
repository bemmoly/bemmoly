import { GcpApiError, type GcpClients } from '../../../clients/gcp/index.ts';
import type { AccountCheck, ConnectionRecord } from '../contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';

/*
 * Attaching a project that already exists (journeys proposal, attached mode). Before anything
 * deploys there, Pipelines checks, as the identity it will deploy as, that it can see the
 * project, that Cloud Run is on, and that it holds what a deploy needs. Every gap becomes one
 * sentence saying what to grant; only the gaps that would stop a deploy fail the check.
 */

const DEPLOY_PERMISSIONS = [
  'run.services.get',
  'run.services.create',
  'run.services.update',
  'run.revisions.get',
  'run.revisions.delete',
  'iam.serviceAccounts.actAs',
];

const CANARY_PERMISSIONS = ['monitoring.timeSeries.list'];

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
      return { name: null, problem: `Project ${projectId} does not exist; check the ID` };
    if (project.state && project.state !== 'ACTIVE') {
      return {
        name: null,
        problem: `Project ${projectId} is ${project.state.toLowerCase()}, not active`,
      };
    }
    return { name: project.displayName ?? project.projectId, problem: null };
  } catch (error) {
    if (denied(error)) {
      return {
        name: null,
        problem: `${who} cannot see project ${projectId}. Grant it Browser or Viewer there`,
      };
    }
    return {
      name: null,
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
    return denied(error) ? { critical: [], soft: [] } : { critical: [], soft: [reasonOf(error)] };
  }
  const missing = (api: string) => !enabled.includes(api);
  const critical = missing('run.googleapis.com')
    ? [`Turn on the Cloud Run Admin API in ${projectId}`]
    : [];
  if (impersonates && missing('iamcredentials.googleapis.com')) {
    critical.push(`Turn on the IAM Service Account Credentials API in ${projectId}`);
  }
  const soft = missing('monitoring.googleapis.com')
    ? [`Turn on the Cloud Monitoring API in ${projectId} so canaries can read error rates`]
    : [];
  return { critical, soft };
}

async function permissionProblems(clients: GcpClients, projectId: string, who: string) {
  const wanted = [...DEPLOY_PERMISSIONS, ...CANARY_PERMISSIONS];
  const held = await clients.resourceManager.testPermissions(`projects/${projectId}`, wanted);
  const lacks = (permission: string) => !held.includes(permission);
  const critical: string[] = [];
  if (DEPLOY_PERMISSIONS.slice(0, 5).some(lacks)) {
    critical.push(`Grant ${who} Cloud Run Developer on ${projectId}`);
  }
  if (lacks('iam.serviceAccounts.actAs')) {
    critical.push(
      `Grant ${who} Service Account User on ${projectId}, or on the account services run as`,
    );
  }
  const soft = CANARY_PERMISSIONS.some(lacks)
    ? [`Grant ${who} Monitoring Viewer on ${projectId} so canaries can read error rates`]
    : [];
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
    const who =
      config.deployerServiceAccount ?? (await context.principal().catch(() => null)) ?? 'Bemmoly';
    const clients = context.deployer(projectId, config);
    try {
      const project = await projectName(clients, projectId, who);
      if (project.problem) return { ok: false, name: null, problems: [project.problem] };
      const apis = await apiProblems(clients, projectId, impersonates);
      const permissions = await permissionProblems(clients, projectId, who);
      const critical = [...apis.critical, ...permissions.critical];
      return {
        ok: critical.length === 0,
        name: project.name,
        problems: [...critical, ...apis.soft, ...permissions.soft],
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
