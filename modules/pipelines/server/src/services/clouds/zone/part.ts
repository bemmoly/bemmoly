import type { CloudResourceKind } from '../../../../../shared/clouds.ts';
import type { DesiredResource } from '../../providers/contract.ts';
import type { SpecInputOf } from '../../providers/specs.ts';
import { keyOf } from '../order.ts';
import type { ZoneAccounts, ZoneConfig } from './accounts.ts';

/*
 * One part of the landing zone: the resources of one or a few kinds it declares in the
 * accounts a layout made, and how the preview names them. A new kind is a new part file and
 * one line in ./index.ts; nothing else in the zone code changes.
 */

export interface ZoneBuild extends ZoneAccounts {
  config: ZoneConfig;
  /** Adds a resource and answers its key, so later resources can depend on it. */
  declare<Kind extends CloudResourceKind>(
    kind: Kind,
    name: string,
    account: string,
    spec: SpecInputOf<Kind>,
    dependsOn?: string[],
  ): string;
}

export interface ZonePart {
  declare(zone: ZoneBuild): void;
  /** How the preview tree names a resource of a kind this part declares. */
  describe: Partial<
    Record<CloudResourceKind, (spec: Record<string, unknown>) => { name: string; note: string }>
  >;
}

/** Every account's services resource: what most others wait for. */
export const apisOf = (account: string) => keyOf({ kind: 'service_api', name: 'apis', account });

export const accountKeyOf = (account: string) => keyOf({ kind: 'account', name: account, account });

/** The shared registry's push grant, which every pull waits for. */
export const REGISTRY = 'apps';
export const registryKeyOf = (home: string) =>
  keyOf({ kind: 'registry_access', name: REGISTRY, account: home });

export function createDeclarer(out: DesiredResource[]): ZoneBuild['declare'] {
  return (kind, name, account, spec, dependsOn = []) => {
    const resource = { kind, name, account, spec, dependsOn };
    out.push(resource);
    return keyOf(resource);
  };
}
