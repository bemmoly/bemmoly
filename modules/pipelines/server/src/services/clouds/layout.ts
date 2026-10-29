import type { Layout } from '../../../../shared/clouds.ts';
import type { DesiredResource } from '../providers/contract.ts';
import { specHash } from './hash.ts';
import {
  ZONE_PARTS,
  createDeclarer,
  declareAccounts,
  zoneConfigSchema,
  type DesiredAccount,
  type ZoneInput,
} from './zone/index.ts';

/*
 * The landing zone as declared (architecture §14): from the connection's layout, the
 * environments and the catalog, the neutral accounts and resources that should exist. The
 * layout decides the accounts (./zone/accounts.ts); each part in ./zone declares its kinds of
 * resource in them. Pure: the same input always declares the same zone.
 */

export type { DesiredAccount, ZoneInput } from './zone/index.ts';

export interface DesiredZone {
  layout: Layout;
  folderName: string;
  accounts: DesiredAccount[];
  resources: DesiredResource[];
  /** Over the whole declaration: what the person previews is what Apply applies. */
  hash: string;
}

export function resourceHash(resource: DesiredResource): string {
  return specHash({ spec: resource.spec, dependsOn: [...resource.dependsOn].sort() });
}

export function buildZone(input: ZoneInput): DesiredZone {
  const config = zoneConfigSchema.parse(input.connection.config);
  const accounts = declareAccounts(input, config);
  const resources: DesiredResource[] = [];
  const zone = { ...accounts, config, declare: createDeclarer(resources) };
  for (const part of ZONE_PARTS) part.declare(zone);
  return {
    layout: input.connection.layout,
    folderName: config.folderName,
    accounts: accounts.all,
    resources,
    hash: specHash({
      layout: input.connection.layout,
      folder: config.folderName,
      accounts: accounts.all,
      resources,
    }),
  };
}
