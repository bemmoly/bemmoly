import type { CloudResourceKind } from '../../../../../shared/clouds.ts';
import type { ConnectionRecord, DesiredResource, LandingZonePart } from '../contract.ts';
import type { GcpContexts } from './context.ts';
import {
  accountKind,
  budgetKind,
  loggingKind,
  networkKind,
  serviceApiKind,
} from './zone-account.ts';
import {
  deployerKind,
  identityKind,
  registryAccessKind,
  secretStoreKind,
} from './zone-identity.ts';
import { specOf, type ZoneKind } from './zone-kind.ts';

/*
 * The landing zone on Google Cloud: each neutral kind read, compared and applied through
 * its mapping. Applying is always "make it match", so repeating it changes nothing.
 */

const KINDS: { [Kind in CloudResourceKind]: ZoneKind<Kind> } = {
  account: accountKind,
  service_api: serviceApiKind,
  network: networkKind,
  deployer_identity: deployerKind,
  runtime_identity: identityKind,
  registry_access: registryAccessKind,
  budget: budgetKind,
  logging: loggingKind,
  secret_store: secretStoreKind,
};

function callFor<Kind extends CloudResourceKind>(
  contexts: GcpContexts,
  connection: ConnectionRecord,
  resource: DesiredResource & { kind: Kind },
) {
  return {
    handler: KINDS[resource.kind] as ZoneKind<Kind>,
    call: {
      context: contexts(connection),
      connection,
      resource,
      spec: specOf(resource.kind, resource),
    },
  };
}

const canonical = (value: unknown) => JSON.stringify(value);

/** Differences in plain words; arrays only need to contain what is wanted. */
export function diffObserved(
  expected: Record<string, unknown>,
  observed: Record<string, unknown>,
): string[] {
  const problems: string[] = [];
  for (const [key, wanted] of Object.entries(expected)) {
    const seen = observed[key];
    if (Array.isArray(wanted)) {
      const have = Array.isArray(seen) ? seen.map(canonical) : [];
      const missing = wanted.filter((item) => !have.includes(canonical(item)));
      if (missing.length > 0) problems.push(`${key} is missing ${missing.join(', ')}`);
    } else if (canonical(seen) !== canonical(wanted)) {
      problems.push(`${key} is ${canonical(seen ?? null)}, wanted ${canonical(wanted)}`);
    }
  }
  return problems;
}

export function createGcpLandingZone(contexts: GcpContexts): LandingZonePart {
  return {
    async read(connection, resource) {
      const { handler, call } = callFor(contexts, connection, resource);
      return handler.read(call);
    },
    async apply(connection, resource) {
      const { handler, call } = callFor(contexts, connection, resource);
      await handler.apply(call);
      const observed = await handler.read(call);
      if (!observed)
        throw new Error(`${resource.kind} ${resource.name} is still missing after apply`);
      return observed;
    },
    diff(resource, observed) {
      const handler = KINDS[resource.kind] as ZoneKind<CloudResourceKind>;
      return diffObserved(handler.expected(specOf(resource.kind, resource), resource), observed);
    },
  };
}
