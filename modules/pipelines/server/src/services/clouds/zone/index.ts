import type { DesiredResource } from '../../providers/contract.ts';
import { budgetPart } from './budget.ts';
import { identitiesPart } from './identities.ts';
import { loggingPart } from './logging.ts';
import { networkPart } from './network.ts';
import type { ZonePart } from './part.ts';
import { projectsPart } from './projects.ts';
import { registryPart } from './registry.ts';
import { secretsPart } from './secrets.ts';

/*
 * The parts of a landing zone, in the order the preview lists them within an account. A new
 * kind of resource (a cluster, say) is a new part here and a new mapping in each provider.
 */
export const ZONE_PARTS: readonly ZonePart[] = [
  projectsPart,
  networkPart,
  identitiesPart,
  registryPart,
  secretsPart,
  loggingPart,
  budgetPart,
];

/** How the preview names a resource; the account's own resource is named by its id. */
export function describeResource(resource: DesiredResource): { name: string; note: string | null } {
  if (resource.kind === 'account') return { name: resource.name, note: null };
  const spec = resource.spec as Record<string, unknown>;
  for (const part of ZONE_PARTS) {
    const describe = part.describe[resource.kind];
    if (describe) return describe(spec);
  }
  return { name: resource.kind, note: null };
}

export {
  declareAccounts,
  zoneConfigSchema,
  type DesiredAccount,
  type ZoneEnvironment,
  type ZoneInput,
} from './accounts.ts';
export { createDeclarer } from './part.ts';
