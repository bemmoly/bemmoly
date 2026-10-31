import type { Layout } from '../../../../shared/clouds.ts';
import type { LandingZoneNode } from '../../../../shared/landing-zones.ts';
import type { DesiredResource } from '../providers/contract.ts';
import type { DesiredAccount, DesiredZone } from './layout.ts';
import { resourceHash } from './layout.ts';
import { keyOf } from './order.ts';
import { describeResource } from './zone/index.ts';

/*
 * The preview a person reads before Apply: the folder, then each account with what will be
 * made in it, each marked as already there, to create, to update or drifted. It is built from
 * what Pipelines last recorded, not from the cloud, so previewing is instant and free.
 */

type Status = LandingZoneNode['status'];

export interface RecordedResource {
  status: 'pending' | 'applying' | 'ready' | 'drifted' | 'failed';
  specHash: string | null;
  everReconciled: boolean;
}

const LAYOUT_WORDS: Record<Layout, string> = {
  starter: 'Starter: platform, non-production and production',
  'per-environment': 'Standard: one per environment',
  'per-domain-environment': 'Enterprise: one per domain and environment',
  'per-group-environment': 'One per group and environment',
};

/** An account Pipelines made that the layout no longer declares. */
export interface KeptAccount {
  externalId: string;
  name: string;
}

export function statusOf(
  resource: DesiredResource,
  recorded: ReadonlyMap<string, RecordedResource>,
): Status {
  const row = recorded.get(keyOf(resource));
  if (!row) return 'create';
  if (row.status === 'drifted') return 'drifted';
  if (row.status === 'ready' && row.specHash === resourceHash(resource)) return 'exists';
  return row.everReconciled ? 'update' : 'create';
}

const worst = (statuses: Status[]): Status => {
  if (statuses.includes('drifted')) return 'drifted';
  if (statuses.every((status) => status === 'exists')) return 'exists';
  return 'update';
};

function accountNode(
  account: DesiredAccount,
  resources: DesiredResource[],
  recorded: ReadonlyMap<string, RecordedResource>,
): LandingZoneNode {
  const own = resources.filter((resource) => resource.account === account.externalId);
  const root = own.find((resource) => resource.kind === 'account');
  const children = own
    .filter((resource) => resource.kind !== 'account')
    .map((resource) => ({
      kind: 'resource' as const,
      ...describeResource(resource),
      status: statusOf(resource, recorded),
      children: [],
    }));
  const rootStatus = root ? statusOf(root, recorded) : 'exists';
  return {
    kind: 'account',
    name: account.externalId,
    note: account.name,
    status:
      rootStatus === 'create'
        ? 'create'
        : worst([rootStatus, ...children.map((child) => child.status)]),
    children,
  };
}

export function previewTree(
  zone: DesiredZone,
  boundaryExists: boolean,
  recorded: ReadonlyMap<string, RecordedResource>,
  kept: readonly KeptAccount[] = [],
): { root: LandingZoneNode; counts: { folders: number; accounts: number; resources: number } } {
  const children: LandingZoneNode[] = [];
  const folders = new Map<string, LandingZoneNode>();
  for (const account of zone.accounts) {
    const node = accountNode(account, zone.resources, recorded);
    if (!account.folder) {
      children.push(node);
      continue;
    }
    let folder = folders.get(account.folder);
    if (!folder) {
      folder = { kind: 'folder', name: account.folder, note: null, status: 'exists', children: [] };
      folders.set(account.folder, folder);
      children.push(folder);
    }
    folder.children.push(node);
  }
  for (const folder of folders.values()) {
    const statuses = folder.children.map((child) => child.status);
    folder.status = statuses.every((status) => status === 'create') ? 'create' : worst(statuses);
    folder.note = `${folder.children.length} accounts`;
  }
  const status = boundaryExists ? worst(children.map((child) => child.status)) : 'create';
  // Kept accounts are listed last and never change the folder's status: nothing happens to them.
  for (const account of kept) {
    children.push({
      kind: 'account',
      name: account.externalId,
      note: account.name,
      status: 'kept',
      children: [],
    });
  }
  const root: LandingZoneNode = {
    kind: 'folder',
    name: zone.folderName,
    note: LAYOUT_WORDS[zone.layout],
    status,
    children,
  };
  return {
    root,
    counts: {
      folders: 1 + folders.size,
      accounts: zone.accounts.length,
      resources: zone.resources.filter((resource) => resource.kind !== 'account').length,
    },
  };
}
