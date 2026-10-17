import { GcpApiError } from '../../../clients/gcp/index.ts';
import type { ConnectionCheck, ConnectionPart, ConnectionRecord } from '../contract.ts';
import type { GcpContexts } from './context.ts';

/*
 * The connection check: who Bemmoly is in Google Cloud, whether it may create folders and
 * projects where it needs to, and whether it may link projects to the billing account. Each
 * failure becomes one sentence saying what to grant or change, never a raw API error.
 */

const FOLDER_PERMISSIONS = ['resourcemanager.folders.create', 'resourcemanager.projects.create'];
const BILLING_PERMISSIONS = ['billing.resourceAssociations.create'];

const reasonOf = (error: unknown) =>
  error instanceof GcpApiError
    ? `Google Cloud answered ${error.status}: ${error.message}`
    : String(error);

async function folderProblems(
  contexts: GcpContexts,
  connection: ConnectionRecord,
  who: string,
): Promise<string[]> {
  const { config, control } = contexts(connection);
  const resource = connection.boundaryRef ?? `organizations/${config.organizationId}`;
  const where = connection.boundaryRef
    ? `the ${config.folderName} folder`
    : `organization ${config.organizationId}`;
  try {
    const held = await control.resourceManager.testPermissions(resource, FOLDER_PERMISSIONS);
    const missing = FOLDER_PERMISSIONS.filter((permission) => !held.includes(permission));
    if (missing.length === 0) return [];
    return [
      `Grant ${who} Folder Creator and Project Creator on ${where}; it cannot create folders or projects there yet`,
    ];
  } catch (error) {
    if (error instanceof GcpApiError && (error.status === 403 || error.status === 404)) {
      return [
        `${who} cannot see ${where}. Check the organization ID and grant it Folder Viewer there`,
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
        `${who} cannot see billing account ${id}. Grant it Billing Account User on that account`,
      ];
    if (!account.open) return [`Billing account ${id} is closed. Choose an open billing account`];
    const held = await control.billing.testPermissions(id, BILLING_PERMISSIONS);
    if (held.length < BILLING_PERMISSIONS.length) {
      return [`Grant ${who} Billing Account User on ${id} so new projects can be linked to it`];
    }
    return [];
  } catch (error) {
    if (error instanceof GcpApiError && error.status === 403) {
      return [
        `${who} cannot see billing account ${id}. Grant it Billing Account User on that account`,
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
            'Bemmoly could not get a Google Cloud token. On Google Cloud, attach a service account to the VM; elsewhere, upload Bemmoly’s keys to a workload identity pool. ' +
              reasonOf(error),
          ],
        };
      }
      const who = principal ?? 'The workload identity pool principal';
      const problems = [
        ...(await folderProblems(contexts, connection, who)),
        ...(await billingProblems(contexts, connection, who)),
      ];
      return { ok: problems.length === 0, principal, problems };
    },
  };
}
