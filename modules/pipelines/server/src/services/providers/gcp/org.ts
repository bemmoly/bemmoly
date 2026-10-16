import { ValidationError } from '@bemmoly/shared';
import type { ConnectionRecord, OrgPart } from '../contract.ts';
import type { GcpContext, GcpContexts } from './context.ts';

/*
 * Folders and projects. Every project Bemmoly creates carries the managed-by label, which is
 * how it finds them again in one search wherever they sit under the folder.
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

function boundaryOf(connection: ConnectionRecord): string {
  if (!connection.boundaryRef) {
    throw new ValidationError(`Create the ${connection.name} folder before its projects`);
  }
  return connection.boundaryRef;
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
  const { resourceManager, billing } = context.control;
  const labels = { ...input.labels, ...MANAGED_LABEL };
  const existing = await resourceManager.getProject(input.projectId);
  if (!existing) {
    await resourceManager.createProject({
      projectId: input.projectId,
      displayName: displayName(input.name),
      parent: input.parent,
      labels,
    });
  } else if (Object.entries(labels).some(([key, value]) => existing.labels[key] !== value)) {
    await resourceManager.updateProjectLabels(input.projectId, { ...existing.labels, ...labels });
  }
  const info = await billing.getProjectBilling(input.projectId);
  const wanted = `billingAccounts/${context.config.billingAccountId}`;
  if (!info.billingEnabled || info.billingAccountName !== wanted) {
    await billing.linkProject(input.projectId, context.config.billingAccountId);
  }
}

export function createGcpOrg(contexts: GcpContexts): OrgPart {
  return {
    async ensureBoundary(connection, name) {
      const context = contexts(connection);
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
      await ensureProject(contexts(connection), {
        projectId: input.externalId,
        name: input.name,
        parent: boundaryOf(connection),
        labels: input.labels,
      });
      return { externalId: input.externalId };
    },

    async checkQuota(connection, count) {
      if (count === 0) return [];
      const { config, control } = contexts(connection);
      const linked = await control.billing.countLinkedProjects(config.billingAccountId);
      const left = Math.max(0, config.projectQuota - linked);
      if (count <= left) return [];
      return [
        `This layout needs ${count} new projects and billing account ${config.billingAccountId} can pay for ${left} more (${linked} of ${config.projectQuota} in use). Ask Google Cloud for a billing quota increase, then record the new limit on this connection, or choose the per-environment layout, which needs fewer projects`,
      ];
    },
  };
}
