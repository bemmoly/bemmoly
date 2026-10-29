import { ValidationError } from '@bemmoly/shared';
import { GcpApiError, type GcpProject } from '../../../clients/gcp/index.ts';
import type { ConnectionRecord, OrgPart } from '../contract.ts';
import type { GcpContext, GcpContexts } from './context.ts';
import {
  BILLING_QUOTA_FORM,
  USUAL_BILLING_LIMIT,
  billingQuotaStop,
  projectQuotaStop,
  takenStop,
} from './quota.ts';

/*
 * Folders and projects. Every project Bemmoly creates carries the managed-by label, which is
 * how it finds them again in one search wherever they sit under the folder. Each step reads
 * before it writes, so an apply that stopped part way is retried without making anything
 * twice: a project made on the first try is found and only its billing link is redone.
 */

export const MANAGED_LABEL = { 'managed-by': 'bemmoly' } as const;

/** Google allows 30 characters in a project's display name. */
const displayName = (name: string) => name.slice(0, 30);

export async function ensureFolder(
  context: GcpContext,
  parent: string,
  name: string,
): Promise<string> {
  const rm = context.control.resourceManager;
  const found = await rm.findFolder(parent, name);
  return (found ?? (await rm.createFolder(parent, name))).name;
}

function boundaryOf(context: GcpContext, connection: ConnectionRecord): string {
  const folder = folderOf(context, connection);
  if (!folder) {
    throw new ValidationError(`Create the ${connection.name} folder before its projects`);
  }
  return folder;
}

/**
 * Creates the project under `parent` if it is missing, keeps its labels as wanted, and links
 * it to the connection's billing account. Safe to repeat.
 */
export async function ensureProject(
  context: GcpContext,
  input: {
    projectId: string;
    name: string;
    parent: string;
    labels: Readonly<Record<string, string>>;
  },
): Promise<void> {
  const { resourceManager } = context.control;
  const labels = { ...input.labels, ...MANAGED_LABEL };
  const existing = await findOwnProject(context, input.projectId);
  if (!existing) {
    try {
      await resourceManager.createProject({
        projectId: input.projectId,
        displayName: displayName(input.name),
        parent: input.parent,
        labels,
      });
    } catch (error) {
      const who = (await context.principal().catch(() => null)) ?? 'Bemmoly';
      throw projectQuotaStop(error, who) ?? takenStop(error, input.projectId) ?? error;
    }
  } else if (Object.entries(labels).some(([key, value]) => existing.labels[key] !== value)) {
    await resourceManager.updateProjectLabels(input.projectId, { ...existing.labels, ...labels });
  }
  await ensureBilling(context, input.projectId);
}

/** The project when it is ours to see; another owner's ID stops the apply. */
async function findOwnProject(context: GcpContext, projectId: string): Promise<GcpProject | null> {
  try {
    return await context.control.resourceManager.getProject(projectId);
  } catch (error) {
    if (error instanceof GcpApiError && error.status === 403) {
      throw takenStop(error, projectId) ?? error;
    }
    throw error;
  }
}

/** Links the project to the connection's billing account unless it already is. */
export async function ensureBilling(context: GcpContext, projectId: string): Promise<void> {
  const { billing } = context.control;
  const id = context.config.billingAccountId;
  const info = await billing.getProjectBilling(projectId);
  if (info.billingEnabled && info.billingAccountName === `billingAccounts/${id}`) return;
  try {
    await billing.linkProject(projectId, id);
  } catch (error) {
    throw billingQuotaStop(error, id) ?? error;
  }
}

/** Where projects go: the folder bootstrap.sh made, or the one Pipelines made itself. */
export function folderOf(context: GcpContext, connection: ConnectionRecord): string | null {
  if (connection.boundaryRef) return connection.boundaryRef;
  return context.config.folderId ? `folders/${context.config.folderId}` : null;
}

export function createGcpOrg(contexts: GcpContexts): OrgPart {
  return {
    async ensureBoundary(connection, name) {
      const context = contexts(connection);
      // A folder named at connect time was made by bootstrap.sh; Bemmoly holds no rights on
      // the organisation to make another.
      const named = folderOf(context, connection);
      if (named) return { ref: named };
      return {
        ref: await ensureFolder(context, `organizations/${context.config.organizationId}`, name),
      };
    },

    async listAccounts(connection) {
      const projects = await contexts(connection).control.resourceManager.searchProjects(
        'labels.managed-by:bemmoly',
      );
      return projects.map((project) => ({
        externalId: project.projectId,
        name: project.displayName ?? project.projectId,
        state:
          project.state === 'ACTIVE'
            ? ('ready' as const)
            : project.state === 'DELETE_REQUESTED'
              ? ('deleted' as const)
              : ('creating' as const),
      }));
    },

    async createAccount(connection, input) {
      const context = contexts(connection);
      await ensureProject(context, {
        projectId: input.externalId,
        name: input.name,
        parent: boundaryOf(context, connection),
        labels: input.labels,
      });
      return { externalId: input.externalId };
    },

    /** Blocks only above a limit an admin recorded; the usual default is only a warning. */
    async checkQuota(connection, count) {
      const { config, control } = contexts(connection);
      if (count === 0 || !config.projectQuota) return [];
      const linked = await control.billing.countLinkedProjects(config.billingAccountId);
      const left = Math.max(0, config.projectQuota - linked);
      if (count <= left) return [];
      return [
        `This layout needs ${count} new projects and billing account ${config.billingAccountId} can pay for ${left} more (${linked} of ${config.projectQuota} in use). Ask Google for more at ${BILLING_QUOTA_FORM}, or choose Starter, which needs fewer projects`,
      ];
    },

    async billing(connection) {
      const { config, control } = contexts(connection);
      return {
        account: config.billingAccountId,
        linked: await control.billing.countLinkedProjects(config.billingAccountId),
        limit: config.projectQuota ?? USUAL_BILLING_LIMIT,
        recorded: config.projectQuota !== undefined,
      };
    },
  };
}
