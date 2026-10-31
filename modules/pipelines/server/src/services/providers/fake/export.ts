import { createHash } from 'node:crypto';
import type { ExportFacts, ExportRecords } from '../export-contract.ts';
import { gkeBackendNames } from '../gcp/export/terraform-front-door-backends.ts';

/*
 * What the simulator answers when an export asks the cloud for facts: a fixed number per
 * project, a folder per domain under the connection's own, and a name per budget, all
 * derived from the names so the same records always export the same files. Zonal endpoint
 * groups sit in the connection region's first zone.
 */

const digits = (value: string, length: number) =>
  BigInt(`0x${createHash('sha256').update(value).digest('hex').slice(0, 15)}`)
    .toString()
    .padStart(length, '1')
    .slice(0, length);

export function simulatedFacts(records: ExportRecords): ExportFacts {
  const projects = new Set([
    ...records.accounts.map((account) => account.externalId),
    ...records.clusters.map((cluster) => cluster.projectId),
  ]);
  const folderOf = new Map(
    records.resources
      .filter((resource) => resource.kind === 'account' && resource.spec['folder'])
      .map((resource) => [resource.account, String(resource.spec['folder'])]),
  );
  const root = records.connection.boundaryRef ?? 'folders/100000000000';
  return {
    accounts: Object.fromEntries(
      [...projects].map((project) => {
        const folder = folderOf.get(project);
        return [
          project,
          {
            number: digits(project, 12),
            parent: folder ? `folders/${digits(`${root}/${folder}`, 12)}` : root,
          },
        ];
      }),
    ),
    budgets: Object.fromEntries(
      records.resources
        .filter((resource) => resource.kind === 'budget')
        .map((resource) => [
          resource.account,
          `billingAccounts/${String(records.connection.config['billingAccountId'] ?? 'SIMULATED')}/budgets/${digits(resource.account, 8)}`,
        ]),
    ),
    // One zonal group per GKE backend, in the first zone of the door's region.
    groups: Object.fromEntries(
      gkeBackendNames(records.frontDoors).map(({ account, name }) => [
        name,
        [
          `https://www.googleapis.com/compute/v1/projects/${account}/zones/${String(records.connection.config['region'] ?? 'us-central1')}-a/networkEndpointGroups/${name}`,
        ],
      ]),
    ),
    problems: [],
  };
}
