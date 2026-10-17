import type { LandingZoneNode, Layout } from '../../../../shared/clouds.ts';
import type { DesiredResource } from '../providers/contract.ts';
import type { DesiredAccount, DesiredZone } from './layout.ts';
import { resourceHash } from './layout.ts';
import { keyOf } from './order.ts';

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
  'per-environment': 'One account per environment',
  'per-domain-environment': 'One account per domain and environment',
  'per-group-environment': 'One account per group and environment',
};

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

function describe(resource: DesiredResource): { name: string; note: string | null } {
  const spec = resource.spec as Record<string, unknown>;
  switch (resource.kind) {
    case 'service_api':
      return { name: 'Services', note: (spec['features'] as string[]).join(', ') };
    case 'network':
      return {
        name: 'Network',
        note: `${String(spec['name'])}, ${String(spec['subnets'])} subnets`,
      };
    case 'deployer_identity':
      return { name: 'Deployer identity', note: 'every deploy acts as it' };
    case 'runtime_identity':
      return spec['purpose'] === 'build'
        ? { name: 'Build identity', note: 'pushes images to the registry' }
        : { name: 'Runtime identity', note: 'what applications run as' };
    case 'registry_access':
      return spec['access'] === 'push'
        ? { name: 'Registry', note: `${String(spec['repository'])} in ${String(spec['region'])}` }
        : { name: 'Registry pull', note: `from ${String(spec['registryAccount'])}` };
    case 'secret_store':
      return {
        name: 'Secret store',
        note: `readable by ${(spec['readers'] as string[]).join(', ')}`,
      };
    case 'logging':
      return { name: 'Logs', note: `kept ${String(spec['retentionDays'])} days` };
    case 'budget':
      return {
        name: 'Budget',
        note: `${String(spec['monthly'])} ${String(spec['currency'])} a month`,
      };
    case 'account':
      return { name: resource.name, note: null };
  }
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
      ...describe(resource),
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
  const root: LandingZoneNode = {
    kind: 'folder',
    name: zone.folderName,
    note: LAYOUT_WORDS[zone.layout],
    status: boundaryExists ? worst(children.map((child) => child.status)) : 'create',
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
