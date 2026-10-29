import { GcpApiError } from '../../../clients/gcp/index.ts';
import type { ConnectionCheck, ConnectionPart, ConnectionRecord } from '../contract.ts';
import { createAttachCheck } from './attach.ts';
import type { GcpContexts } from './context.ts';
import { folderOf } from './org.ts';

/*
 * The connection check: who Bemmoly is in Google Cloud, and whether it holds exactly the
 * permissions managed mode needs on the folder bootstrap.sh made and on the billing account.
 * Each permission missing becomes one sentence naming the role to grant and where, never a
 * raw API error. Connections made before the folder grant are checked on their organisation.
 */

/** Each permission the folder grant gives, and the role that holds it. */
const FOLDER_GRANTS = [
  {
    permission: 'resourcemanager.projects.create',
    role: 'Project Creator (roles/resourcemanager.projectCreator)',
    why: 'so it can create projects there',
  },
  {
    permission: 'resourcemanager.folders.create',
    role: 'Folder Creator (roles/resourcemanager.folderCreator)',
    why: 'so the Enterprise layout can make a folder per domain',
  },
] as const;

const BILLING_PERMISSION = 'billing.resourceAssociations.create';
const BILLING_ROLE = 'Billing Account User (roles/billing.user)';

const reasonOf = (error: unknown) =>
  error instanceof GcpApiError
    ? `Google Cloud answered ${error.status}: ${error.message}`
    : String(error);

function placeOf(contexts: GcpContexts, connection: ConnectionRecord) {
  const context = contexts(connection);
  const { config } = context;
  const folder = folderOf(context, connection);
  if (folder) return { resource: folder, where: `folder ${folder.replace(/^folders\//, '')}` };
  return {
    resource: `organizations/${config.organizationId}`,
    where: `organization ${config.organizationId}`,
  };
}

async function folderProblems(
  contexts: GcpContexts,
  connection: ConnectionRecord,
  who: string,
): Promise<string[]> {
  const { control } = contexts(connection);
  const { resource, where } = placeOf(contexts, connection);
  try {
    const wanted = FOLDER_GRANTS.map((grant) => grant.permission);
    const held = await control.resourceManager.testPermissions(resource, wanted);
    return FOLDER_GRANTS.filter((grant) => !held.includes(grant.permission)).map(
      (grant) => `Grant ${who} ${grant.role} on ${where}, ${grant.why}`,
    );
  } catch (error) {
    if (error instanceof GcpApiError && (error.status === 403 || error.status === 404)) {
      return [
        `${who} cannot see ${where}. Check the ID bootstrap.sh printed, and grant it Folder Viewer (roles/resourcemanager.folderViewer) there`,
      ];
    }
    return [`Bemmoly could not check ${where}. ${reasonOf(error)}`];
  }
}

async function billingProblems(
  contexts: GcpContexts,
  connection: ConnectionRecord,
  who: string,
): Promise<string[]> {
  const { config, control } = contexts(connection);
  const id = config.billingAccountId;
  try {
    const account = await control.billing.getAccount(id);
    if (!account)
      return [
        `${who} cannot see billing account ${id}. Grant it ${BILLING_ROLE} on that billing account`,
      ];
    if (!account.open) return [`Billing account ${id} is closed. Choose an open billing account`];
    const held = await control.billing.testPermissions(id, [BILLING_PERMISSION]);
    if (!held.includes(BILLING_PERMISSION)) {
      return [
        `Grant ${who} ${BILLING_ROLE} on billing account ${id}, so new projects can be linked to it`,
      ];
    }
    return [];
  } catch (error) {
    if (error instanceof GcpApiError && error.status === 403) {
      return [
        `${who} cannot see billing account ${id}. Grant it ${BILLING_ROLE} on that billing account`,
      ];
    }
    return [`Bemmoly could not check billing account ${id}. ${reasonOf(error)}`];
  }
}

export function createGcpConnection(contexts: GcpContexts): ConnectionPart {
  return {
    async verify(connection): Promise<ConnectionCheck> {
      let principal: string | null;
      try {
        principal = await contexts(connection).principal();
      } catch (error) {
        return {
          ok: false,
          principal: null,
          problems: [
            'Bemmoly could not get a Google Cloud token. On Google Cloud, attach a service account to the VM; on a laptop, run gcloud auth application-default login; elsewhere, upload Bemmoly’s keys to a workload identity pool. ' +
              reasonOf(error),
          ],
        };
      }
      // An attached connection creates nothing, so folders and billing are not its concern;
      // each project it deploys into is checked when it is attached.
      if (contexts(connection).config.mode === 'attached') {
        return { ok: true, principal, problems: [] };
      }
      const who = principal ?? 'The workload identity pool principal';
      const problems = [
        ...(await folderProblems(contexts, connection, who)),
        ...(await billingProblems(contexts, connection, who)),
      ];
      return { ok: problems.length === 0, principal, problems };
    },
    verifyAccount: createAttachCheck(contexts),
  };
}
